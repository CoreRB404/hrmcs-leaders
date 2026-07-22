const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { signToken } = require('../utils/auth');

const port = 5500 + (process.pid % 400);
const dbPath = path.join(__dirname, `authorization-boundaries-${process.pid}.db`);
const server = spawn(process.execPath, ['server.js'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, PORT: String(port), HRMCS_DB_PATH: dbPath },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const hospitalToken = signToken({ id: 'hospital-demo', role: 'Hospital', hospitalId: 'hospital-demo' });
const otherHospitalToken = signToken({ id: 'hospital-central', role: 'Hospital', hospitalId: 'hospital-central' });
const reviewerToken = signToken({ id: 'hospital-doctor', role: 'Doctor', hospitalId: 'hospital-demo' });

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

function api(endpoint, { token, method = 'GET', body } = {}) {
  return fetch(`http://localhost:${port}${endpoint}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

(async () => {
  try {
    await waitForServer();

    assert.equal((await api('/api/inventory')).status, 401, 'inventory requires authentication');
    assert.equal((await api('/api/hospitals')).status, 401, 'hospital directory requires authentication');

    const registrationResponse = await api('/api/hospitals/register', {
      method: 'POST',
      body: {
        name: 'Role Spoof Hospital',
        location: 'North District',
        email: `role-spoof-${process.pid}@hospital.org`,
        password: 'securepass123',
        role: 'Admin',
        visibility: 'Public',
        type: 'General',
        emergencyStatus: 'Medium',
      },
    });
    assert.equal(registrationResponse.status, 201);
    const registration = await registrationResponse.json();
    assert.equal(registration.role, 'Hospital', 'public registration cannot create privileged roles');

    const directoryResponse = await api('/api/hospitals', { token: hospitalToken });
    assert.equal(directoryResponse.status, 200);
    const directory = await directoryResponse.json();
    assert.ok(directory.every((hospital) => hospital.accountStatus === 'Active'));
    assert.ok(!directory.some((hospital) => hospital.id === registration.id), 'pending registrations stay out of the active directory');

    const reviewerListingResponse = await api('/api/hospitals/listing', {
      token: reviewerToken,
      method: 'POST',
      body: { hospitalId: 'hospital-central', resourceName: 'Spoofed Supply', quantity: 3, availableForBorrow: true },
    });
    assert.equal(reviewerListingResponse.status, 403, 'reviewers cannot publish hospital inventory');

    const suspendResponse = await api('/api/hospitals/reviewers/hospital-doctor', {
      token: hospitalToken,
      method: 'PATCH',
      body: { accountStatus: 'Suspended' },
    });
    assert.equal(suspendResponse.status, 200);
    assert.equal((await api('/api/dashboard', { token: reviewerToken })).status, 401, 'suspended accounts cannot keep using an old token');

    const listingResponse = await api('/api/hospitals/listing', {
      token: hospitalToken,
      method: 'POST',
      body: { hospitalId: 'hospital-central', resourceName: `Owned Supply ${process.pid}`, quantity: 3, availableForBorrow: true },
    });
    assert.equal(listingResponse.status, 201);
    const listing = await listingResponse.json();
    assert.equal(listing.hospitalId, 'hospital-demo', 'listing ownership comes from the authenticated hospital');

    const editResponse = await api(`/api/inventory/${listing.id}`, {
      token: hospitalToken,
      method: 'PATCH',
      body: { resourceName: listing.resourceName, quantity: 9, availableForBorrow: true, availableForOrder: true },
    });
    assert.equal(editResponse.status, 200);
    const editedListing = await editResponse.json();
    assert.equal(editedListing.availableQuantity, 9);

    const networkInventory = await (await api('/api/inventory', { token: hospitalToken })).json();
    assert.equal(networkInventory.find((item) => item.id === listing.id).availableQuantity, 9, 'inventory edits appear in network availability');

    const duplicateResponse = await api('/api/hospitals/listing', {
      token: hospitalToken,
      method: 'POST',
      body: { resourceName: listing.resourceName.toUpperCase(), quantity: 2, availableForBorrow: true },
    });
    assert.equal(duplicateResponse.status, 400, 'duplicate supply names are rejected case-insensitively');

    const secondListingResponse = await api('/api/hospitals/listing', {
      token: hospitalToken,
      method: 'POST',
      body: { resourceName: `Second Supply ${process.pid}`, quantity: 2, availableForBorrow: true },
    });
    assert.equal(secondListingResponse.status, 201);
    const secondListing = await secondListingResponse.json();
    const duplicateRename = await api(`/api/inventory/${secondListing.id}`, {
      token: hospitalToken,
      method: 'PATCH',
      body: { resourceName: listing.resourceName.toUpperCase(), quantity: 2, availableForBorrow: true, availableForOrder: false },
    });
    assert.equal(duplicateRename.status, 400, 'editing cannot create a duplicate supply name');
    assert.equal((await api(`/api/inventory/${secondListing.id}`, { token: hospitalToken, method: 'DELETE' })).status, 200);

    const deactivateResponse = await api(`/api/inventory/${listing.id}/status`, {
      token: hospitalToken,
      method: 'PATCH',
      body: { status: 'Inactive' },
    });
    assert.equal(deactivateResponse.status, 200);
    const inventoryAfterDeactivate = await (await api('/api/inventory', { token: hospitalToken })).json();
    assert.equal(inventoryAfterDeactivate.some((item) => item.id === listing.id), false, 'inactive listings leave network availability');

    const reactivateResponse = await api(`/api/inventory/${listing.id}/status`, {
      token: hospitalToken,
      method: 'PATCH',
      body: { status: 'Active' },
    });
    assert.equal(reactivateResponse.status, 200);

    const wrongOwnerEdit = await api(`/api/inventory/${listing.id}`, {
      token: otherHospitalToken,
      method: 'PATCH',
      body: { resourceName: listing.resourceName, quantity: 1, availableForBorrow: true, availableForOrder: true },
    });
    assert.equal(wrongOwnerEdit.status, 400, 'another hospital cannot edit the listing');

    const deleteResponse = await api(`/api/inventory/${listing.id}`, { token: hospitalToken, method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    const inventoryAfterDelete = await (await api('/api/inventory', { token: hospitalToken })).json();
    assert.equal(inventoryAfterDelete.some((item) => item.id === listing.id), false, 'deleted listings leave network availability');

    const requestResponse = await api('/api/requests', {
      token: hospitalToken,
      method: 'POST',
      body: {
        requesterHospitalId: 'hospital-central',
        providerHospitalId: 'hospital-central',
        resourceName: 'Ventilators',
        quantity: 1,
        requestType: 'Borrow',
        urgency: 'High',
      },
    });
    assert.equal(requestResponse.status, 200);
    const requestResult = await requestResponse.json();
    assert.equal(requestResult.request.requesterHospitalId, 'hospital-demo', 'request ownership comes from the authenticated hospital');

    console.log('authorization boundary test passed');
  } finally {
    server.kill();
    await new Promise((resolve) => {
      if (server.exitCode != null) resolve();
      else server.once('exit', resolve);
    });
    for (const suffix of ['', '-shm', '-wal']) {
      const file = `${dbPath}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
