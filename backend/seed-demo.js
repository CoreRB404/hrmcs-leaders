const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const dbPath = path.join(__dirname, 'app.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

const schema = [
  `CREATE TABLE hospitals (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, visibility TEXT NOT NULL, type TEXT NOT NULL, role TEXT NOT NULL, accountStatus TEXT NOT NULL, createdAt TEXT NOT NULL, emergencyStatus TEXT NOT NULL, capacity INTEGER NOT NULL, availableBeds INTEGER NOT NULL, availableIcu INTEGER NOT NULL, availableAmbulances INTEGER NOT NULL, distance INTEGER NOT NULL)`,
  `CREATE TABLE inventory (id TEXT PRIMARY KEY, hospitalId TEXT NOT NULL, resourceType TEXT NOT NULL, resourceName TEXT NOT NULL, quantity INTEGER NOT NULL, availableForBorrow INTEGER NOT NULL, availableForOrder INTEGER NOT NULL, createdAt TEXT NOT NULL)`,
  `CREATE TABLE staff (id TEXT PRIMARY KEY, hospitalId TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, count INTEGER NOT NULL, createdAt TEXT NOT NULL)`,
  `CREATE TABLE requests (id TEXT PRIMARY KEY, hospitalId TEXT NOT NULL, patientType TEXT, need TEXT, priority TEXT, notes TEXT, status TEXT NOT NULL, createdAt TEXT NOT NULL, type TEXT NOT NULL)`,
  `CREATE TABLE notifications (id TEXT PRIMARY KEY, message TEXT NOT NULL, severity TEXT NOT NULL)`,
];

const hospitals = [
  { id: 'hospital-admin', name: 'Admin Hospital', location: 'Downtown', email: 'admin@hrmcs.org', password: hash('Admin@1234'), visibility: 'Public', type: 'General', role: 'Admin', accountStatus: 'Active', createdAt: '2026-07-09T00:00:00.000Z', emergencyStatus: 'High', capacity: 220, availableBeds: 90, availableIcu: 16, availableAmbulances: 6, distance: 0 },
  { id: 'hospital-demo', name: 'Northside Hospital', location: 'Northside', email: 'hospital@demo.org', password: hash('Hospital@1234'), visibility: 'Public', type: 'General', role: 'Hospital', accountStatus: 'Active', createdAt: '2026-07-09T00:00:00.000Z', emergencyStatus: 'Medium', capacity: 260, availableBeds: 90, availableIcu: 14, availableAmbulances: 5, distance: 3 },
  { id: 'hospital-central', name: 'Central Medical Center', location: 'Midtown', email: 'central@demo.org', password: hash('Central@1234'), visibility: 'Public', type: 'Trauma', role: 'Hospital', accountStatus: 'Active', createdAt: '2026-07-09T00:00:00.000Z', emergencyStatus: 'High', capacity: 300, availableBeds: 115, availableIcu: 18, availableAmbulances: 8, distance: 4 },
  { id: 'hospital-riverside', name: 'Riverside Community Hospital', location: 'Riverside', email: 'riverside@demo.org', password: hash('Riverside@1234'), visibility: 'Private', type: 'Community', role: 'Hospital', accountStatus: 'Active', createdAt: '2026-07-09T00:00:00.000Z', emergencyStatus: 'Medium', capacity: 180, availableBeds: 65, availableIcu: 10, availableAmbulances: 3, distance: 6 },
  { id: 'hospital-westbridge', name: 'Westbridge General', location: 'Westbridge', email: 'westbridge@demo.org', password: hash('Westbridge@1234'), visibility: 'Public', type: 'General', role: 'Hospital', accountStatus: 'Pending', createdAt: '2026-07-09T00:00:00.000Z', emergencyStatus: 'Low', capacity: 150, availableBeds: 42, availableIcu: 7, availableAmbulances: 2, distance: 8 },
  { id: 'hospital-eastbay', name: 'Eastbay Care Institute', location: 'Eastbay', email: 'eastbay@demo.org', password: hash('Eastbay@1234'), visibility: 'Public', type: 'Specialty', role: 'Hospital', accountStatus: 'Active', createdAt: '2026-07-09T00:00:00.000Z', emergencyStatus: 'High', capacity: 240, availableBeds: 78, availableIcu: 17, availableAmbulances: 5, distance: 5 },
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

const requests = [
  ['request-1', 'hospital-demo', 'ICU', 'Ventilator support', 'High', 'Needs urgent support', 'Pending', '2026-07-09T00:00:00.000Z', 'Borrow'],
  ['request-2', 'hospital-central', 'Emergency', 'Blood products', 'High', 'Rapid response needed', 'Pending', '2026-07-09T00:00:00.000Z', 'Borrow'],
  ['request-3', 'hospital-riverside', 'General', 'Masks', 'Medium', 'Supply replenishment', 'Approved', '2026-07-09T00:00:00.000Z', 'Order'],
  ['request-4', 'hospital-eastbay', 'Pediatric', 'IV fluids', 'High', 'Critical care need', 'Pending', '2026-07-09T00:00:00.000Z', 'Borrow'],
  ['request-5', 'hospital-demo', 'General', 'Portable monitors', 'Medium', 'Short-term loan', 'Pending', '2026-07-09T00:00:00.000Z', 'Borrow'],
];

const notifications = [
  ['notification-1', 'Admin Hospital onboarded to the network.', 'Info'],
  ['notification-2', 'Northside Hospital posted new inventory availability.', 'Info'],
  ['notification-3', 'Central Medical Center requested emergency support.', 'High'],
  ['notification-4', 'Riverside Community Hospital is waiting for account approval.', 'Medium'],
  ['notification-5', 'Eastbay Care Institute added new specialty inventory.', 'Info'],
  ['notification-6', 'A new transfer request needs admin review.', 'High'],
];

db.serialize(() => {
  schema.forEach((sql) => db.run(sql));

  hospitals.forEach((hospital) => {
    db.run(`INSERT INTO hospitals (id, name, location, email, password, visibility, type, role, accountStatus, createdAt, emergencyStatus, capacity, availableBeds, availableIcu, availableAmbulances, distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [hospital.id, hospital.name, hospital.location, hospital.email, hospital.password, hospital.visibility, hospital.type, hospital.role, hospital.accountStatus, hospital.createdAt, hospital.emergencyStatus, hospital.capacity, hospital.availableBeds, hospital.availableIcu, hospital.availableAmbulances, hospital.distance]);
  });

  inventory.forEach((row) => {
    db.run(`INSERT INTO inventory (id, hospitalId, resourceType, resourceName, quantity, availableForBorrow, availableForOrder, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, row);
  });

  staffEntries.forEach((row) => {
    db.run(`INSERT INTO staff (id, hospitalId, role, status, count, createdAt) VALUES (?, ?, ?, ?, ?, ?)`, row);
  });

  requests.forEach((row) => {
    db.run(`INSERT INTO requests (id, hospitalId, patientType, need, priority, notes, status, createdAt, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, row);
  });

  notifications.forEach((row) => {
    db.run(`INSERT INTO notifications (id, message, severity) VALUES (?, ?, ?)`, row);
  });
});

db.close((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('Seed completed');
});
