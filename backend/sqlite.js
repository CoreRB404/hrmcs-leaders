const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'app.db');
let seedPromise = null;

function openDb() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Failed to open SQLite database', err.message);
    }
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function closeAsync(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
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
        createdAt TEXT NOT NULL
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        hospitalId TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        count INTEGER NOT NULL,
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
        status TEXT NOT NULL,
        providerApproval TEXT,
        providerResponseNotes TEXT,
        history TEXT,
        createdAt TEXT NOT NULL,
        type TEXT
      )
    `);

    await runAsync(db, `
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        severity TEXT NOT NULL
      )
    `);

    await closeAsync(db);
  } catch (error) {
    console.error('Failed to initialize Db', error);
  }
}

function seedDefaultUsers() {
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = new Promise(async (resolve, reject) => {
    await initializeDb();
    const db = openDb();
    const crypto = require('crypto');
    const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

    try {
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

      const staffEntries = [
        ['staff-1', 'hospital-demo', 'Nurse', 'Available', 6, '2026-07-09T00:00:00.000Z'],
        ['staff-2', 'hospital-demo', 'Respiratory Therapist', 'Available', 3, '2026-07-09T00:00:00.000Z'],
        ['staff-3', 'hospital-central', 'Surgeon', 'Available', 4, '2026-07-09T00:00:00.000Z'],
        ['staff-4', 'hospital-central', 'Nurse', 'Available', 10, '2026-07-09T00:00:00.000Z'],
        ['staff-5', 'hospital-riverside', 'Technician', 'Deployable', 5, '2026-07-09T00:00:00.000Z'],
        ['staff-6', 'hospital-riverside', 'Nurse', 'Available', 7, '2026-07-09T00:00:00.000Z'],
        ['staff-7', 'hospital-eastbay', 'Nurse', 'Available', 8, '2026-07-09T00:00:00.000Z'],
        ['staff-8', 'hospital-eastbay', 'Pharmacist', 'Available', 3, '2026-07-09T00:00:00.000Z'],
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
          status: 'Pending',
          providerApproval: 'Pending',
          providerResponseNotes: '',
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
          status: 'Pending',
          providerApproval: 'Pending',
          providerResponseNotes: '',
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
          status: 'Pending',
          providerApproval: 'Approved',
          providerResponseNotes: 'Ready to send',
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
          status: 'Pending',
          providerApproval: 'Pending',
          providerResponseNotes: '',
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
          status: 'Approved',
          providerApproval: 'Approved',
          providerResponseNotes: 'Approved by provider and admin',
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

      // Clear all tables
      await runAsync(db, 'DELETE FROM hospitals');
      await runAsync(db, 'DELETE FROM inventory');
      await runAsync(db, 'DELETE FROM staff');
      await runAsync(db, 'DELETE FROM requests');
      await runAsync(db, 'DELETE FROM notifications');

      // Insert hospitals
      for (const hospital of hospitals) {
        await runAsync(db, `
          INSERT INTO hospitals (id, name, location, email, password, visibility, type, role, accountStatus, createdAt, emergencyStatus, capacity, availableBeds, availableIcu, availableAmbulances, distance)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          hospital.id, hospital.name, hospital.location, hospital.email, hospital.password,
          hospital.visibility, hospital.type, hospital.role, hospital.accountStatus,
          hospital.createdAt, hospital.emergencyStatus, hospital.capacity, hospital.availableBeds,
          hospital.availableIcu, hospital.availableAmbulances, hospital.distance,
        ]);
      }

      // Insert inventory
      for (const row of inventory) {
        await runAsync(db, `
          INSERT INTO inventory (id, hospitalId, resourceType, resourceName, quantity, availableForBorrow, availableForOrder, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, row);
      }

      // Insert staff
      for (const row of staffEntries) {
        await runAsync(db, `
          INSERT INTO staff (id, hospitalId, role, status, count, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `, row);
      }

      // Insert requests with new schema
      for (const req of requests) {
        await runAsync(db, `
          INSERT INTO requests (id, requesterHospitalId, providerHospitalId, resourceName, quantity, requestType, notes, status, providerApproval, providerResponseNotes, history, createdAt, type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          req.id, req.requesterHospitalId, req.providerHospitalId, req.resourceName,
          req.quantity, req.requestType, req.notes, req.status, req.providerApproval,
          req.providerResponseNotes, req.history, req.createdAt, req.type,
        ]);
      }

      // Insert notifications
      for (const row of notifications) {
        await runAsync(db, `
          INSERT INTO notifications (id, message, severity)
          VALUES (?, ?, ?)
        `, row);
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
    db.all('SELECT * FROM inventory ORDER BY createdAt', (err, rows) => {
      db.close();
      if (err) reject(err); else resolve(rows);
    });
  });
}

function getStaff() {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all('SELECT * FROM staff ORDER BY createdAt', (err, rows) => {
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

function getHospitalByEmail(email) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.get('SELECT * FROM hospitals WHERE email = ?', [email], (err, row) => {
      db.close();
      if (err) reject(err); else resolve(row);
    });
  });
}

// ---- Write-through persistence helpers ----

async function insertHospital(hospital) {
  const db = openDb();
  try {
    await runAsync(db, `
      INSERT OR REPLACE INTO hospitals (id, name, location, email, password, visibility, type, role, accountStatus, createdAt, emergencyStatus, capacity, availableBeds, availableIcu, availableAmbulances, distance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      hospital.id, hospital.name, hospital.location, hospital.email, hospital.password,
      hospital.visibility, hospital.type, hospital.role, hospital.accountStatus,
      hospital.createdAt, hospital.emergencyStatus, hospital.capacity, hospital.availableBeds,
      hospital.availableIcu, hospital.availableAmbulances, hospital.distance,
    ]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to persist hospital to SQLite', err);
  }
}

async function updateHospitalStatus(hospitalId, accountStatus) {
  const db = openDb();
  try {
    await runAsync(db, 'UPDATE hospitals SET accountStatus = ? WHERE id = ?', [accountStatus, hospitalId]);
    await closeAsync(db);
  } catch (err) {
    try { await closeAsync(db); } catch (e) { /* ignore */ }
    console.error('Failed to update hospital status in SQLite', err);
  }
}

async function deleteHospitalById(hospitalId) {
  const db = openDb();
  try {
    await runAsync(db, 'DELETE FROM hospitals WHERE id = ?', [hospitalId]);
    await runAsync(db, 'DELETE FROM inventory WHERE hospitalId = ?', [hospitalId]);
    await runAsync(db, 'DELETE FROM staff WHERE hospitalId = ?', [hospitalId]);
    await runAsync(db, 'DELETE FROM requests WHERE requesterHospitalId = ? OR providerHospitalId = ?', [hospitalId, hospitalId]);
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
      INSERT OR REPLACE INTO requests (id, requesterHospitalId, providerHospitalId, hospitalId, resourceName, patientType, need, quantity, requestType, priority, notes, status, providerApproval, providerResponseNotes, history, createdAt, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      request.status,
      request.providerApproval || null,
      request.providerResponseNotes || null,
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
      UPDATE requests SET status = ?, providerApproval = ?, providerResponseNotes = ?, history = ? WHERE id = ?
    `, [
      request.status,
      request.providerApproval || null,
      request.providerResponseNotes || null,
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

seedDefaultUsers().catch((error) => {
  console.error('Failed to seed default database rows', error);
});

module.exports = {
  initializeDb,
  seedDefaultUsers,
  getHospitals,
  getInventory,
  getStaff,
  getRequests,
  getNotifications,
  getHospitalByEmail,
  // Write-through persistence
  insertHospital,
  updateHospitalStatus,
  deleteHospitalById,
  insertRequest,
  updateRequest,
  checkEmailExists,
};
