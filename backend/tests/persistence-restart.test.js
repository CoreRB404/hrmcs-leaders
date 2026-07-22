const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dbPath = path.join(__dirname, `persistence-${process.pid}.db`);
const childEnv = { ...process.env, HRMCS_DB_PATH: dbPath };

function runPhase(phase) {
  const result = spawnSync(process.execPath, [__filename, phase], {
    cwd: path.join(__dirname, '..'),
    env: childEnv,
    encoding: 'utf8',
  });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
}

async function child(phase) {
  const sqlite = require('../sqlite');
  await sqlite.seedDefaultUsers();

  if (phase === 'write') {
    await sqlite.insertHospital({
      id: 'hospital-persistence-test',
      name: 'Persistence Test Hospital',
      location: 'Test City',
      email: 'persistence@test.local',
      password: 'test-hash',
      visibility: 'Private',
      type: 'General',
      role: 'Hospital',
      accountStatus: 'Pending',
      createdAt: new Date().toISOString(),
      emergencyStatus: 'Low',
      capacity: 10,
      availableBeds: 5,
      availableIcu: 1,
      availableAmbulances: 1,
      distance: 0,
    });
    await sqlite.upsertInventoryItem({
      id: 'inventory-persistence-test',
      hospitalId: 'hospital-persistence-test',
      resourceType: 'Supply',
      resourceName: 'Test Supply',
      quantity: 7,
      availableForBorrow: true,
      availableForOrder: false,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  const [hospitals, inventory] = await Promise.all([
    sqlite.getHospitals(),
    sqlite.getInventory(),
  ]);
  assert(hospitals.some((item) => item.id === 'hospital-persistence-test'));
  assert(inventory.some((item) => item.id === 'inventory-persistence-test'));
}

if (process.argv[2]) {
  child(process.argv[2]).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  try {
    runPhase('write');
    runPhase('verify');
    console.log('persistence restart test passed');
  } finally {
    for (const suffix of ['', '-shm', '-wal']) {
      const file = `${dbPath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
}
