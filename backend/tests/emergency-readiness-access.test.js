const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { signToken } = require('../utils/auth');

const port = 4500 + (process.pid % 1000);
const dbPath = path.join(__dirname, `emergency-readiness-${process.pid}.db`);
const server = spawn(process.execPath, ['server.js'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: String(port), HRMCS_DB_PATH: dbPath },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) return;
    } catch (error) {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for test server');
}

async function updateStatus(token, hospitalId, emergencyStatus) {
  return fetch(`http://localhost:${port}/api/hospitals/${hospitalId}/emergency-status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ emergencyStatus }),
  });
}

async function updateDistance(token, hospitalId, distance) {
  return fetch(`http://localhost:${port}/api/hospitals/${hospitalId}/distance`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ distance }),
  });
}

async function assertStatus(responsePromise, expectedStatus) {
  const response = await responsePromise;
  const body = await response.clone().text();
  assert.equal(response.status, expectedStatus, body);
}

(async () => {
  try {
    await waitForServer();
    const hospitalToken = signToken({ id: 'hospital-demo', role: 'Hospital', hospitalId: 'hospital-demo' });
    const reviewerToken = signToken({ id: 'hospital-doctor', role: 'Doctor', hospitalId: 'hospital-demo' });
    const adminToken = signToken({ id: 'hospital-admin', role: 'Admin', hospitalId: 'hospital-admin' });

    await assertStatus(updateStatus(hospitalToken, 'hospital-demo', 'High'), 200);
    await assertStatus(updateStatus(hospitalToken, 'hospital-central', 'Low'), 403);
    await assertStatus(updateStatus(reviewerToken, 'hospital-demo', 'Low'), 403);
    await assertStatus(updateStatus(adminToken, 'hospital-central', 'Medium'), 200);
    await assertStatus(updateDistance(hospitalToken, 'hospital-demo', 2.5), 200);
    await assertStatus(updateDistance(hospitalToken, 'hospital-central', 2.5), 403);
    await assertStatus(updateDistance(reviewerToken, 'hospital-demo', 2.5), 403);
    await assertStatus(updateDistance(adminToken, 'hospital-central', 4.5), 200);
    await assertStatus(updateDistance(adminToken, 'hospital-central', -1), 400);
    console.log('emergency readiness access test passed');
  } finally {
    server.kill();
    for (const suffix of ['', '-shm', '-wal']) {
      const file = `${dbPath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
