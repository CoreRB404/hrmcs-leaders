const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { readDb } = require('../utils/storage');

const canonicalDbPath = path.join(__dirname, '../data/database.json');
const processDbPath = path.join(__dirname, `../data/database-${process.pid}.json`);

if (fs.existsSync(canonicalDbPath)) {
  const state = readDb();
  const admin = state.hospitals.find((hospital) => hospital.email === 'adminhospital');
  assert(admin, 'Expected the seeded admin hospital to be available from the app database');
  assert.strictEqual(admin.role, 'Admin');
  console.log('auth login seed test passed');
} else {
  console.log('auth login seed test skipped: database.json not found');
}
