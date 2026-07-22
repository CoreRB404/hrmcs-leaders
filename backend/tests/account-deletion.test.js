const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDemoData } = require('../data');
const data = require('../data');
const { registerHospital, deleteHospitalAccount } = require('../utils/hospitalService');

test('admin can delete a hospital account and remove linked data', () => {
  resetDemoData();

  const hospital = registerHospital({
    name: 'Hospital Z',
    location: 'West End',
    email: 'z@hospital.org',
    password: 'secret123',
    visibility: 'Public',
    type: 'General',
  });

  const state = data.getState();
  state.hospitals = state.hospitals.map((entry) => entry.id === hospital.id ? { ...entry, accountStatus: 'Active' } : entry);
  data.setState(state);

  const inventoryEntry = { id: 'listing-1', hospitalId: hospital.id, resourceType: 'Supply', resourceName: 'IV Fluids', quantity: 10, publishedQuantity: 10, availableQuantity: 10, lentQuantity: 0, reserved: 0, availableForBorrow: true, availableForOrder: true, status: 'Listed', minimumThreshold: 5 };
  state.inventory = [inventoryEntry];
  state.requests = [{ id: 'req-1', requesterHospitalId: hospital.id, providerHospitalId: 'hospital-b', resourceName: 'Masks', quantity: 2, requestType: 'Borrow', notes: '', status: 'Pending', providerApproval: 'Pending', providerResponseNotes: '', history: [], createdAt: '2026-07-04T00:00:00.000Z' }];
  data.setState(state);

  const result = deleteHospitalAccount(hospital.id);

  assert.equal(result.deletedHospital.id, hospital.id);
  assert.equal(data.getHospitals().some((entry) => entry.id === hospital.id), false);
  assert.equal(data.getInventory().some((entry) => entry.hospitalId === hospital.id), false);
  assert.equal(data.getRequests().some((entry) => entry.requesterHospitalId === hospital.id), false);
});
