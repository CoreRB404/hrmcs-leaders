const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const isTestRun = process.argv.includes('--test');
const DB_PATH = process.env.HRMCS_DB_PATH
  ? path.resolve(process.env.HRMCS_DB_PATH)
  : path.join(__dirname, isTestRun ? `app-${process.pid}.db` : 'app.db');
let seedPromise = null;
let dbOperationQueue = Promise.resolve();
const hospitalEmailCache = new Map();

function withDbLock(operation) {
  const next = dbOperationQueue.then(operation, operation);
  dbOperationQueue = next.catch(() => {});
  return next;
}

function resetSeedState() {
  seedPromise = null;
  hospitalEmailCache.clear();
  return Promise.resolve();
}

function openDb() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Failed to open SQLite database', err.message);
    }
  });
  db.configure('busyTimeout', 3000);
  return db;
}

function runAsync(db, sql, params = []) {
  return withDbLock(() => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  }));
}

function allAsync(db, sql, params = []) {
  return withDbLock(() => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  }));
}

function getAsync(db, sql, params = []) {
  return withDbLock(() => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  }));
}

function closeAsync(db) {
  return withDbLock(() => new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  }));
}

async function initializeDb() {
  const db = openDb();

  try {
    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        visibility TEXT NOT NULL,
        type TEXT NOT NULL,
        role TEXT NOT NULL,
        hospitalId TEXT,
        accountStatus TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        emergencyStatus TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        availableBeds INTEGER NOT NULL,
        availableIcu INTEGER NOT NULL,
        availableAmbulances INTEGER NOT NULL,
        distance INTEGER NOT NULL
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        hospitalId TEXT NOT NULL,
        resourceType TEXT NOT NULL,
        resourceName TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        availableForBorrow INTEGER NOT NULL,
        availableForOrder INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        createdAt TEXT NOT NULL
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        requesterHospitalId TEXT,
        providerHospitalId TEXT,
        hospitalId TEXT,
        resourceName TEXT,
        patientType TEXT,
        need TEXT,
        quantity INTEGER,
        requestType TEXT,
        priority TEXT,
        notes TEXT,
        urgency TEXT,
        status TEXT NOT NULL,
        providerApproval TEXT,
        providerResponseNotes TEXT,
        pharmacistApproval TEXT,
        pharmacistApprovalNotes TEXT,
        doctorApproval TEXT,
        doctorApprovalNotes TEXT,
        history TEXT,
        createdAt TEXT NOT NULL,
        type TEXT
      )
    `);

    const hospitalTableInfo = await allAsync(db, "PRAGMA table_info(hospitals)");
    const hospitalColumns = new Set(hospitalTableInfo.map((column) => column.name));
    if (!hospitalColumns.has('hospitalId')) {
      try {
        await runAsync(db, 'ALTER TABLE hospitals ADD COLUMN hospitalId TEXT');
      } catch (error) {
        // initializeDb can be entered concurrently during startup/tests.
        if (!String(error.message).includes('duplicate column name')) throw error;
      }
    }

    const tableInfo = await allAsync(db, "PRAGMA table_info(requests)");
    const existingColumns = new Set(tableInfo.map((column) => column.name));
    const migrations = [
      ['urgency', 'TEXT'],
      ['pharmacistApproval', 'TEXT'],
      ['pharmacistApprovalNotes', 'TEXT'],
      ['doctorApproval', 'TEXT'],
      ['doctorApprovalNotes', 'TEXT'],
    ];

    for (const [columnName, columnType] of migrations) {
      if (!existingColumns.has(columnName)) {
        await runAsync(db, `ALTER TABLE requests ADD COLUMN ${columnName} ${columnType}`);
      }
    }

    const inventoryTableInfo = await allAsync(db, "PRAGMA table_info(inventory)");
    const inventoryColumns = new Set(inventoryTableInfo.map((column) => column.name));
    for (const [columnName, columnType] of [
      ['publishedQuantity', 'INTEGER'], ['availableQuantity', 'INTEGER'],
      ['lentQuantity', 'INTEGER DEFAULT 0'], ['status', "TEXT DEFAULT 'Active'"],
    ]) {
      if (!inventoryColumns.has(columnName)) {
        try {
          await runAsync(db, `ALTER TABLE inventory ADD COLUMN ${columnName} ${columnType}`);
        } catch (error) {
          if (!String(error.message).includes('duplicate column name')) throw error;
        }
      }
    }
    await runAsync(db, "UPDATE inventory SET publishedQuantity = COALESCE(publishedQuantity, quantity), availableQuantity = COALESCE(availableQuantity, quantity), lentQuantity = COALESCE(lentQuantity, 0), status = COALESCE(status, 'Active')");

    // The product is supply-only. Remove legacy patient-support records and
    // the retired staffing table during migration.
    await runAsync(db, "DELETE FROM requests WHERE type = 'PatientSupport'");
    await runAsync(db, 'DROP TABLE IF EXISTS staff');

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        severity TEXT NOT NULL,
        timestamp TEXT
      )
    `);
    const notificationTableInfo = await allAsync(db, "PRAGMA table_info(notifications)");
    const notificationColumns = new Set(notificationTableInfo.map((column) => column.name));
    for (const [columnName, columnType] of [['timestamp', 'TEXT']]) {
      if (!notificationColumns.has(columnName)) await runAsync(db, `ALTER TABLE notifications ADD COLUMN ${columnName} ${columnType}`);
    }

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS hospital_distances (
        fromHospitalId TEXT NOT NULL,
        toHospitalId TEXT NOT NULL,
        distance REAL NOT NULL,
        PRIMARY KEY (fromHospitalId, toHospitalId)
      )
    `);

    const defaultDistances = [
      ['hospital-admin', 'hospital-demo', 3], ['hospital-admin', 'hospital-central', 4],
      ['hospital-admin', 'hospital-riverside', 6], ['hospital-admin', 'hospital-westbridge', 8],
      ['hospital-admin', 'hospital-eastbay', 5],
    ];
    await runAsync(db, "DELETE FROM hospital_distances WHERE fromHospitalId <> 'hospital-admin' AND toHospitalId <> 'hospital-admin'");
    for (const [fromHospitalId, toHospitalId, distance] of defaultDistances) {
      await runAsync(db, `INSERT OR IGNORE INTO hospital_distances (fromHospitalId, toHospitalId, distance) VALUES (?, ?, ?)`, [fromHospitalId, toHospitalId, distance]);
    }

    await closeAsync(db);
  } catch (error) {
    console.error('Failed to initialize Db', error);
  }
}

function seedDefaultUsers({ force = false } = {}) {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = new Promise(async (resolve, reject) => {
    await initializeDb();
    const db = openDb();
    const crypto = require('crypto');
    const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

    try {
      // Startup seeding must be non-destructive. Once the database contains
      // hospitals, it is the source of truth and must survive server restarts.
      // Tests and explicit demo resets can still request a clean seed with
      // `force: true`.
      const existing = await getAsync(db, 'SELECT COUNT(*) AS count FROM hospitals');
      if (!force && existing.count > 0) {
        const persistedRows = await allAsync(db, 'SELECT * FROM hospitals ORDER BY createdAt');
        hospitalEmailCache.clear();
        for (const row of persistedRows) {
          hospitalEmailCache.set(row.email, row);
        }
        await closeAsync(db);
        resolve();
        return;
      }

      const reviewerAssignments = [
        { hospitalId: 'hospital-demo', slug: 'northside', location: 'Northside', doctorEmail: 'doctor@demo.org', pharmacistEmail: 'pharmacist@demo.org' },
        { hospitalId: 'hospital-central', slug: 'central', location: 'Midtown' },
        { hospitalId: 'hospital-riverside', slug: 'riverside', location: 'Riverside' },
        { hospitalId: 'hospital-westbridge', slug: 'westbridge', location: 'Westbridge' },
        { hospitalId: 'hospital-eastbay', slug: 'eastbay', location: 'Eastbay' },
      ];
      const reviewerAccounts = reviewerAssignments.flatMap((assignment) => [
        {
          id: assignment.slug === 'northside' ? 'hospital-pharmacist' : `reviewer-${assignment.slug}-pharmacist`,
          hospitalId: assignment.hospitalId,
          name: `${assignment.slug[0].toUpperCase()}${assignment.slug.slice(1)} Pharmacist`,
          location: assignment.location,
          email: assignment.pharmacistEmail || `pharmacist.${assignment.slug}@demo.org`,
          password: hash('Pharmacist@1234'),
          visibility: 'Private',
          type: 'Pharmacy',
          role: 'Pharmacist',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'Medium',
          capacity: 0,
          availableBeds: 0,
          availableIcu: 0,
          availableAmbulances: 0,
          distance: 0,
        },
        {
          id: assignment.slug === 'northside' ? 'hospital-doctor' : `reviewer-${assignment.slug}-doctor`,
          hospitalId: assignment.hospitalId,
          name: `${assignment.slug[0].toUpperCase()}${assignment.slug.slice(1)} Doctor`,
          location: assignment.location,
          email: assignment.doctorEmail || `doctor.${assignment.slug}@demo.org`,
          password: hash('Doctor@1234'),
          visibility: 'Private',
          type: 'Clinical',
          role: 'Doctor',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'Medium',
          capacity: 0,
          availableBeds: 0,
          availableIcu: 0,
          availableAmbulances: 0,
          distance: 0,
        },
      ]);

      const hospitals = [
        {
          id: 'hospital-admin',
          name: 'Admin Hospital',
          location: 'Downtown',
          email: 'admin@hrmcs.org',
          password: hash('Admin@1234'),
          visibility: 'Public',
          type: 'General',
          role: 'Admin',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'High',
          capacity: 220,
          availableBeds: 90,
          availableIcu: 16,
          availableAmbulances: 6,
          distance: 0,
        },
        {
          id: 'hospital-demo',
          name: 'Northside Hospital',
          location: 'Northside',
          email: 'hospital@demo.org',
          password: hash('Hospital@1234'),
          visibility: 'Public',
          type: 'General',
          role: 'Hospital',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'Medium',
          capacity: 260,
          availableBeds: 90,
          availableIcu: 14,
          availableAmbulances: 5,
          distance: 3,
        },
        {
          id: 'hospital-central',
          name: 'Central Medical Center',
          location: 'Midtown',
          email: 'central@demo.org',
          password: hash('Central@1234'),
          visibility: 'Public',
          type: 'Trauma',
          role: 'Hospital',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'High',
          capacity: 300,
          availableBeds: 115,
          availableIcu: 18,
          availableAmbulances: 8,
          distance: 4,
        },
        {
          id: 'hospital-riverside',
          name: 'Riverside Community Hospital',
          location: 'Riverside',
          email: 'riverside@demo.org',
          password: hash('Riverside@1234'),
          visibility: 'Private',
          type: 'Community',
          role: 'Hospital',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'Medium',
          capacity: 180,
          availableBeds: 65,
          availableIcu: 10,
          availableAmbulances: 3,
          distance: 6,
        },
        {
          id: 'hospital-westbridge',
          name: 'Westbridge General',
          location: 'Westbridge',
          email: 'westbridge@demo.org',
          password: hash('Westbridge@1234'),
          visibility: 'Public',
          type: 'General',
          role: 'Hospital',
          accountStatus: 'Pending',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'Low',
          capacity: 150,
          availableBeds: 42,
          availableIcu: 7,
          availableAmbulances: 2,
          distance: 8,
        },
        {
          id: 'hospital-eastbay',
          name: 'Eastbay Care Institute',
          location: 'Eastbay',
          email: 'eastbay@demo.org',
          password: hash('Eastbay@1234'),
          visibility: 'Public',
          type: 'Specialty',
          role: 'Hospital',
          accountStatus: 'Active',
          createdAt: '2026-07-09T00:00:00.000Z',
          emergencyStatus: 'High',
          capacity: 240,
          availableBeds: 78,
          availableIcu: 17,
          availableAmbulances: 5,
          distance: 5,
        },
        ...reviewerAccounts,
      ];

      const inventory = [
        ['inventory-1', 'hospital-demo', 'Supply', 'Oxygen Tanks', 12, 1, 1, '2026-07-09T00:00:00.000Z'],
        ['inventory-2', 'hospital-demo', 'Supply', 'Blood Bags', 8, 1, 0, '2026-07-09T00:00:00.000Z'],
        ['inventory-3', 'hospital-central', 'Supply', 'Ventilators', 6, 1, 1, '2026-07-09T00:00:00.000Z'],
        ['inventory-4', 'hospital-central', 'Supply', 'IV Fluids', 15, 1, 1, '2026-07-09T00:00:00.000Z'],
        ['inventory-5', 'hospital-riverside', 'Supply', 'Masks', 20, 1, 1, '2026-07-09T00:00:00.000Z'],
        ['inventory-6', 'hospital-riverside', 'Supply', 'Gloves', 40, 1, 1, '2026-07-09T00:00:00.000Z'],
        ['inventory-7', 'hospital-eastbay', 'Supply', 'Portable Monitors', 9, 1, 1, '2026-07-09T00:00:00.000Z'],
        ['inventory-8', 'hospital-eastbay', 'Supply', 'Defibrillators', 4, 1, 0, '2026-07-09T00:00:00.000Z'],
      ];

      // Seed requests now use the proper runtime schema with requesterHospitalId/providerHospitalId
      const timestamp = '2026-07-09T00:00:00.000Z';
      const requests = [
        {
          id: 'request-1',
          requesterHospitalId: 'hospital-demo',
          providerHospitalId: 'hospital-central',
          resourceName: 'Ventilators',
          quantity: 2,
          requestType: 'Borrow',
          notes: 'Needs urgent ventilator support',
          urgency: 'High',
          status: 'Pending',
          providerApproval: 'Pending',
          providerResponseNotes: '',
          pharmacistApproval: 'Pending',
          pharmacistApprovalNotes: '',
          doctorApproval: 'Pending',
          doctorApprovalNotes: '',
          history: JSON.stringify([
            { id: 'history-1-1', status: 'Requested', note: 'Northside Hospital requested 2 Ventilators from Central Medical Center', timestamp },
          ]),
          createdAt: timestamp,
          type: 'Borrow',
        },
        {
          id: 'request-2',
          requesterHospitalId: 'hospital-central',
          providerHospitalId: 'hospital-demo',
          resourceName: 'Blood Bags',
          quantity: 4,
          requestType: 'Borrow',
          notes: 'Rapid response needed for emergency department',
          urgency: 'Critical',
          status: 'Pending',
          providerApproval: 'Pending',
          providerResponseNotes: '',
          pharmacistApproval: 'Pending',
          pharmacistApprovalNotes: '',
          doctorApproval: 'Pending',
          doctorApprovalNotes: '',
          history: JSON.stringify([
            { id: 'history-2-1', status: 'Requested', note: 'Central Medical Center requested 4 Blood Bags from Northside Hospital', timestamp },
          ]),
          createdAt: timestamp,
          type: 'Borrow',
        },
        {
          id: 'request-3',
          requesterHospitalId: 'hospital-riverside',
          providerHospitalId: 'hospital-eastbay',
          resourceName: 'Portable Monitors',
          quantity: 3,
          requestType: 'Borrow',
          notes: 'Short-term monitoring loan',
          urgency: 'Medium',
          status: 'Pending',
          providerApproval: 'Approved',
          providerResponseNotes: 'Ready to send',
          pharmacistApproval: 'Approved',
          pharmacistApprovalNotes: 'Reviewed',
          doctorApproval: 'Approved',
          doctorApprovalNotes: 'Reviewed',
          history: JSON.stringify([
            { id: 'history-3-1', status: 'Requested', note: 'Riverside Community Hospital requested 3 Portable Monitors from Eastbay Care Institute', timestamp },
            { id: 'history-3-2', status: 'Approved', note: 'Eastbay Care Institute approved the request', timestamp },
          ]),
          createdAt: timestamp,
          type: 'Borrow',
        },
        {
          id: 'request-4',
          requesterHospitalId: 'hospital-eastbay',
          providerHospitalId: 'hospital-riverside',
          resourceName: 'Masks',
          quantity: 10,
          requestType: 'Borrow',
          notes: 'Critical care need for masks',
          urgency: 'High',
          status: 'Pending',
          providerApproval: 'Pending',
          providerResponseNotes: '',
          pharmacistApproval: 'Pending',
          pharmacistApprovalNotes: '',
          doctorApproval: 'Pending',
          doctorApprovalNotes: '',
          history: JSON.stringify([
            { id: 'history-4-1', status: 'Requested', note: 'Eastbay Care Institute requested 10 Masks from Riverside Community Hospital', timestamp },
          ]),
          createdAt: timestamp,
          type: 'Borrow',
        },
        {
          id: 'request-5',
          requesterHospitalId: 'hospital-demo',
          providerHospitalId: 'hospital-eastbay',
          resourceName: 'Portable Monitors',
          quantity: 2,
          requestType: 'Borrow',
          notes: 'Short-term loan for patient monitoring',
          urgency: 'Medium',
          status: 'Approved',
          providerApproval: 'Approved',
          providerResponseNotes: 'Approved by provider and admin',
          pharmacistApproval: 'Approved',
          pharmacistApprovalNotes: 'Approved',
          doctorApproval: 'Approved',
          doctorApprovalNotes: 'Approved',
          history: JSON.stringify([
            { id: 'history-5-1', status: 'Requested', note: 'Northside Hospital requested 2 Portable Monitors from Eastbay Care Institute', timestamp },
            { id: 'history-5-2', status: 'Approved', note: 'Eastbay Care Institute approved the request', timestamp },
            { id: 'history-5-3', status: 'AdminApproved', note: 'Admin approved request request-5', timestamp },
          ]),
          createdAt: timestamp,
          type: 'Borrow',
        },
      ];

      const notifications = [
        ['notification-1', 'Admin Hospital onboarded to the network.', 'Info'],
        ['notification-2', 'Northside Hospital posted new inventory availability.', 'Info'],
        ['notification-3', 'Central Medical Center requested emergency support.', 'High'],
        ['notification-4', 'Westbridge General is waiting for account approval.', 'Medium'],
        ['notification-5', 'Eastbay Care Institute added new specialty inventory.', 'Info'],
        ['notification-6', 'A new transfer request needs admin review.', 'High'],
      ];

      // A forced reset (or first run) starts from the known demo dataset.
      await runAsync(db, 'DELETE FROM hospitals');
      await runAsync(db, 'DELETE FROM inventory');
      await runAsync(db, 'DELETE FROM requests');
      await runAsync(db, 'DELETE FROM notifications');
      await runAsync(db, 'DELETE FROM hospital_distances');

      // Insert hospitals
      for (const hospital of hospitals) {
        await runAsync(db, `
          INSERT OR REPLACE INTO hospitals (id, name, location, email, password, visibility, type, role, hospitalId, accountStatus, createdAt, emergencyStatus, capacity, availableBeds, availableIcu, availableAmbulances, distance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          hospital.id, hospital.name, hospital.location, hospital.email, hospital.password,
          hospital.visibility, hospital.type, hospital.role, hospital.hospitalId || null, hospital.accountStatus,
          hospital.createdAt, hospital.emergencyStatus, hospital.capacity, hospital.availableBeds,
          hospital.availableIcu, hospital.availableAmbulances, hospital.distance,
        ]);
      }

      // Insert inventory
      for (const row of inventory) {
        await runAsync(db, `
          INSERT OR REPLACE INTO inventory (id, hospitalId, resourceType, resourceName, quantity, availableForBorrow, availableForOrder, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, row);
      }

      // Insert requests with new schema
      for (const req of requests) {
        await runAsync(db, `
          INSERT OR REPLACE INTO requests (id, requesterHospitalId, providerHospitalId, resourceName, quantity, requestType, notes, urgency, status, providerApproval, providerResponseNotes, pharmacistApproval, pharmacistApprovalNotes, doctorApproval, doctorApprovalNotes, history, createdAt, type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          req.id, req.requesterHospitalId, req.providerHospitalId, req.resourceName,
          req.quantity, req.requestType, req.notes, req.urgency || 'Low', req.status, req.providerApproval,
          req.providerResponseNotes, req.pharmacistApproval || 'Pending', req.pharmacistApprovalNotes || '', req.doctorApproval || 'Pending', req.doctorApprovalNotes || '', req.history, req.createdAt, req.type,
        ]);
      }

      // Insert notifications
      for (const row of notifications) {
        await runAsync(db, `
          INSERT OR REPLACE INTO notifications (id, message, severity)
          VALUES (?, ?, ?)
        `, row);
      }

      const defaultDistances = [
        ['hospital-admin', 'hospital-demo', 3], ['hospital-admin', 'hospital-central', 4],
        ['hospital-admin', 'hospital-riverside', 6], ['hospital-admin', 'hospital-westbridge', 8],
        ['hospital-admin', 'hospital-eastbay', 5],
      ];
      for (const row of defaultDistances) {
        await runAsync(db, `INSERT OR REPLACE INTO hospital_distances (fromHospitalId, toHospitalId, distance) VALUES (?, ?, ?)`, row);
      }

      const seededRows = await allAsync(db, 'SELECT id, email, accountStatus, password, name, location, visibility, type, role, hospitalId, createdAt, emergencyStatus, capacity, availableBeds, availableIcu, availableAmbulances, distance FROM hospitals ORDER BY createdAt');
      hospitalEmailCache.clear();
      for (const row of seededRows) {
        hospitalEmailCache.set(row.email, row);
      }

      await closeAsync(db);
      resolve();
    } catch (err) {
      try { await closeAsync(db); } catch (e) { /* ignore */ }
      reject(err);
    }
  });

  return seedPromise;
}

// ---- Read helpers ----

function getHospitals() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all('SELECT * FROM hospitals ORDER BY createdAt', (err, rows) => {
      db.close();
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getInventory() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all(`
      SELECT
        id,
        hospitalId,
        resourceType,
        resourceName,
        quantity,
        COALESCE(publishedQuantity, quantity) AS publishedQuantity,
        COALESCE(availableQuantity, quantity) AS availableQuantity,
        COALESCE(lentQuantity, 0) AS lentQuantity,
        availableForBorrow,
        availableForOrder,
        COALESCE(status, 'Active') AS status,
        createdAt
      FROM inventory
      ORDER BY createdAt
    `, (err, rows) => {
      db.close();
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getRequests() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = openDb();
      const rows = await allAsync(db, 'SELECT * FROM requests ORDER BY createdAt');
      await closeAsync(db);
      // Parse history JSON back into arrays
      const parsed = rows.map((row) => ({
        ...row,
        history: row.history ? JSON.parse(row.history) : [],
      }));
      resolve(parsed);
    } catch (err) {
      reject(err);
    }
  });
}

function getNotifications() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all('SELECT * FROM notifications ORDER BY rowid', (err, rows) => {
      db.close();
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getHospitalDistances() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all('SELECT fromHospitalId, toHospitalId, distance FROM hospital_distances ORDER BY fromHospitalId, toHospitalId', (err, rows) => {
      db.close();
      if (err) reject(err); else resolve(rows);
    });
  });
}

function rememberHospitalEmail(hospital) {
  if (hospital?.email) {
    hospitalEmailCache.set(hospital.email, hospital);
  }
}

function getHospitalByEmail(email) {
  const cachedRow = hospitalEmailCache.get(email);
  if (cachedRow) {
    return Promise.resolve(cachedRow);
  }

  return new Promise((resolve, reject) => {
    const db = openDb();
    db.get('SELECT * FROM hospitals WHERE email = ?', [email], (err, row) => {
      db.close();
      if (err) reject(err); else {
        if (row) {
          hospitalEmailCache.set(email, row);
        }
        resolve(row);
      }
    });
  });
}

// ---- Write-through persistence helpers ----

async function insertHospital(hospital) {
  const db = openDb();
  try {
    hospitalEmailCache.set(hospital.email, hospital);
    await runAsync(db, `
      INSERT OR REPLACE INTO hospitals (id, name, location, email, password, visibility, type, role, hospitalId, accountStatus, createdAt, emergencyStatus, capacity, availableBeds, availableIcu, availableAmbulances, distance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      hospital.id, hospital.name, hospital.location, hospital.email, hospital.password,
      hospital.visibility, hospital.type, hospital.role, hospital.hospitalId || null, hospital.accountStatus,
      hospital.createdAt, hospital.emergencyStatus, hospital.capacity, hospital.availableBeds,
      hospital.availableIcu, hospital.availableAmbulances, hospital.distance,
    ]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to persist hospital to SQLite', err);
  }
}

async function upsertHospitalDistance(fromHospitalId, toHospitalId, distance) {
  if (!fromHospitalId || !toHospitalId || fromHospitalId === toHospitalId) return;
  const [fromId, toId] = [fromHospitalId, toHospitalId].sort();
  const db = openDb();
  try {
    await runAsync(db, `
      INSERT OR REPLACE INTO hospital_distances (fromHospitalId, toHospitalId, distance)
      VALUES (?, ?, ?)
    `, [fromId, toId, distance]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    throw err;
  }
}

async function upsertInventoryItem(item) {
  const db = openDb();
  try {
    await runAsync(db, `
      INSERT OR REPLACE INTO inventory (id, hospitalId, resourceType, resourceName, quantity, publishedQuantity, availableQuantity, lentQuantity, availableForBorrow, availableForOrder, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      item.id,
      item.hospitalId,
      item.resourceType,
      item.resourceName,
      item.quantity,
      item.publishedQuantity ?? item.quantity,
      item.availableQuantity ?? item.quantity,
      item.lentQuantity || 0,
      item.availableForBorrow ? 1 : 0,
      item.availableForOrder ? 1 : 0,
      item.status === 'Inactive' ? 'Inactive' : 'Active',
      item.createdAt || new Date().toISOString(),
    ]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    throw err;
  }
}

async function deleteInventoryItem(itemId) {
  const db = openDb();
  try {
    await runAsync(db, 'DELETE FROM inventory WHERE id = ?', [itemId]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    throw err;
  }
}

async function updateHospitalStatus(hospitalId, accountStatus) {
  const db = openDb();
  try {
    await runAsync(db, 'UPDATE hospitals SET accountStatus = ? WHERE id = ?', [accountStatus, hospitalId]);
    for (const [email, hospital] of hospitalEmailCache.entries()) {
      if (hospital.id === hospitalId) {
        hospital.accountStatus = accountStatus;
        hospitalEmailCache.set(email, hospital);
      }
    }
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to update hospital status in SQLite', err);
  }
}

async function updateHospitalAccount(account) {
  const db = openDb();
  try {
    const existing = await getAsync(db, 'SELECT * FROM hospitals WHERE id = ?', [account.id]);
    if (!existing) throw new Error('Account not found');
    await runAsync(db, 'UPDATE hospitals SET email = ?, password = ?, accountStatus = ? WHERE id = ?', [
      account.email,
      account.password,
      account.accountStatus,
      account.id,
    ]);
    if (existing.email !== account.email) hospitalEmailCache.delete(existing.email);
    hospitalEmailCache.set(account.email, { ...existing, ...account });
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    throw err;
  }
}

async function deleteHospitalById(hospitalId) {
  const db = openDb();
  try {
    await runAsync(db, 'DELETE FROM hospitals WHERE id = ? OR hospitalId = ?', [hospitalId, hospitalId]);
    await runAsync(db, 'DELETE FROM inventory WHERE hospitalId = ?', [hospitalId]);
    await runAsync(db, 'DELETE FROM requests WHERE requesterHospitalId = ? OR providerHospitalId = ?', [hospitalId, hospitalId]);
    await runAsync(db, 'DELETE FROM hospital_distances WHERE fromHospitalId = ? OR toHospitalId = ?', [hospitalId, hospitalId]);
    for (const [email, hospital] of hospitalEmailCache.entries()) {
      if (hospital.id === hospitalId || hospital.hospitalId === hospitalId) {
        hospitalEmailCache.delete(email);
      }
    }
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to delete hospital from SQLite', err);
  }
}

async function insertRequest(request) {
  const db = openDb();
  try {
    await runAsync(db, `
      INSERT OR REPLACE INTO requests (id, requesterHospitalId, providerHospitalId, hospitalId, resourceName, patientType, need, quantity, requestType, priority, notes, urgency, status, providerApproval, providerResponseNotes, pharmacistApproval, pharmacistApprovalNotes, doctorApproval, doctorApprovalNotes, history, createdAt, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      request.id,
      request.requesterHospitalId || null,
      request.providerHospitalId || null,
      request.hospitalId || null,
      request.resourceName || null,
      request.patientType || null,
      request.need || null,
      request.quantity || null,
      request.requestType || null,
      request.priority || null,
      request.notes || null,
      request.urgency || 'Low',
      request.status,
      request.providerApproval || null,
      request.providerResponseNotes || null,
      request.pharmacistApproval || 'Pending',
      request.pharmacistApprovalNotes || '',
      request.doctorApproval || 'Pending',
      request.doctorApprovalNotes || '',
      JSON.stringify(request.history || []),
      request.createdAt,
      request.type || null,
    ]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to persist request to SQLite', err);
  }
}

async function updateRequest(request) {
  const db = openDb();
  try {
    await runAsync(db, `
      UPDATE requests SET status = ?, providerApproval = ?, providerResponseNotes = ?, pharmacistApproval = ?, pharmacistApprovalNotes = ?, doctorApproval = ?, doctorApprovalNotes = ?, urgency = ?, history = ? WHERE id = ?
    `, [
      request.status,
      request.providerApproval || null,
      request.providerResponseNotes || null,
      request.pharmacistApproval || 'Pending',
      request.pharmacistApprovalNotes || '',
      request.doctorApproval || 'Pending',
      request.doctorApprovalNotes || '',
      request.urgency || 'Low',
      JSON.stringify(request.history || []),
      request.id,
    ]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to update request in SQLite', err);
  }
}

async function checkEmailExists(email) {
  const db = openDb();
  try {
    const row = await getAsync(db, 'SELECT id FROM hospitals WHERE email = ?', [email]);
    await closeAsync(db);
    return Boolean(row);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    return false;
  }
}

module.exports = {
  initializeDb,
  seedDefaultUsers,
  resetSeedState,
  getHospitals,
  getInventory,
  getRequests,
  getNotifications,
  getHospitalDistances,
  getHospitalByEmail,
  // Write-through persistence
  insertHospital,
  upsertHospitalDistance,
  upsertInventoryItem,
  deleteInventoryItem,
  updateHospitalStatus,
  updateHospitalAccount,
  deleteHospitalById,
  insertRequest,
  updateRequest,
  checkEmailExists,
  rememberHospitalEmail,
};
