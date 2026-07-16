const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDemoData } = require('../data');
const data = require('../data');
const { registerHospital, addResourceListing, createResourceRequest, respondToRequest, reviewRequestClinicalStage, approveRequest, createPatientSupportRequest, getAdminSummary, prioritizeRequests } = require('../utils/hospitalService');

test('integrated hospital flows: registration, listing, request lifecycle, patient-support', async () => {
  // Run full flow sequentially to avoid test-worker races
  await resetDemoData();

  // registration
  const hospital = registerHospital({
    name: 'Hospital G',
    location: 'North Loop',
    email: 'g@hospital.org',
    password: 'secret123',
    visibility: 'Public',
    type: 'General',
  });
  assert.equal(hospital.name, 'Hospital G');
  assert.equal(hospital.visibility, 'Public');
  assert.equal(hospital.accountStatus, 'Pending');
  assert.equal(hospital.password, undefined);
  assert.ok(hospital.reviewerCredentials.doctor.email);
  assert.equal(hospital.reviewerCredentials.doctor.password, 'Doctor@1234');
  assert.ok(hospital.reviewerCredentials.pharmacist.email);
  assert.equal(hospital.reviewerCredentials.pharmacist.password, 'Pharmacist@1234');
  const generatedReviewers = data.getHospitals().filter((entry) => entry.hospitalId === hospital.id);
  assert.deepEqual(generatedReviewers.map((entry) => entry.role).sort(), ['Doctor', 'Pharmacist']);
  assert.ok(generatedReviewers.every((entry) => entry.accountStatus === 'Pending'));
  assert.ok(generatedReviewers.every((entry) => !['Doctor@1234', 'Pharmacist@1234'].includes(entry.password)));

  // publish listing and create request
  const state = data.getState();
  state.hospitals = state.hospitals.map((entry) => entry.id === hospital.id ? { ...entry, accountStatus: 'Active' } : entry);
  data.setState(state);

  const listing = addResourceListing({
    hospitalId: hospital.id,
    resourceType: 'Supply',
    resourceName: 'Oxygen Tanks',
    quantity: 40,
    availableForBorrow: true,
    availableForOrder: true,
  });

  assert.equal(listing.publishedQuantity, 40);
  assert.equal(listing.availableQuantity, 40);
  assert.equal(listing.lentQuantity, 0);

  const request = createResourceRequest({
    requesterHospitalId: 'hospital-a',
    providerHospitalId: hospital.id,
    resourceName: 'Oxygen Tanks',
    quantity: 10,
    requestType: 'Borrow',
    notes: 'Emergency support',
  });

  const summary = getAdminSummary();
  assert.equal(request.status, 'Pending');
  assert.equal(request.providerApproval, 'Pending');
  assert.equal(data.getInventory().find((item) => item.id === listing.id).quantity, 40, 'request creation must not consume stock');
  assert.ok(summary.totalHospitals >= 3);
  assert.equal(summary.totalTransactions, 6);

  // pharmacist then doctor review before the receiving hospital responds
  const pharmacistReview = reviewRequestClinicalStage({
    requestId: request.id,
    reviewerHospitalId: hospital.id,
    reviewerRole: 'Pharmacist',
    decision: 'approve',
    notes: 'Pharmacy verification complete',
  });
  assert.equal(pharmacistReview.pharmacistApproval, 'Approved');

  const doctorReview = reviewRequestClinicalStage({
    requestId: request.id,
    reviewerHospitalId: hospital.id,
    reviewerRole: 'Doctor',
    decision: 'approve',
    notes: 'Clinical oversight complete',
  });
  assert.equal(doctorReview.doctorApproval, 'Approved');

  const providerResponse = respondToRequest({
    requestId: request.id,
    responderHospitalId: hospital.id,
    response: 'approve',
    notes: 'Ready to transfer',
  });
  assert.equal(providerResponse.providerApproval, 'Approved');
  assert.equal(providerResponse.status, 'Pending');
  assert.equal(data.getInventory().find((item) => item.id === listing.id).quantity, 30, 'provider acceptance commits stock');

  // admin approves and finalizes inventory
  const finalRequest = approveRequest({
    requestId: request.id,
    approverHospitalId: 'hospital-admin',
  });
  assert.equal(finalRequest.status, 'Approved');
  assert.equal(finalRequest.providerApproval, 'Approved');
  const inventoryItem = data.getInventory().find((item) => item.hospitalId === hospital.id && item.resourceName === 'Oxygen Tanks');
  assert.equal(inventoryItem.quantity, 30);
  assert.equal(inventoryItem.publishedQuantity, 40);
  assert.equal(inventoryItem.availableQuantity, 30);
  assert.equal(inventoryItem.lentQuantity, 10);

  // patient-support
  const supportRequest = createPatientSupportRequest({
    hospitalId: 'hospital-a',
    patientType: 'ICU',
    need: 'Ventilator support',
    priority: 'High',
    notes: 'Need urgent transfer support',
  });
  const summary2 = getAdminSummary();
  assert.equal(supportRequest.status, 'Open');
  assert.equal(summary2.totalTransactions, 7);
  assert.equal(supportRequest.priority, 'High');
});

test('provider queues prioritize urgency, FIFO, and aging without hiding requests', () => {
  const now = new Date('2026-07-16T12:00:00.000Z').getTime();
  const requests = [
    { id: 'low-old', providerHospitalId: 'provider-a', urgency: 'Low', status: 'Pending', type: 'Borrow', createdAt: '2026-07-14T12:00:00.000Z' },
    { id: 'high-new', providerHospitalId: 'provider-a', urgency: 'High', status: 'Pending', type: 'Borrow', createdAt: '2026-07-16T11:00:00.000Z' },
    { id: 'critical-new', providerHospitalId: 'provider-a', urgency: 'Critical', status: 'Pending', type: 'Borrow', createdAt: '2026-07-16T11:30:00.000Z' },
    { id: 'other-provider', providerHospitalId: 'provider-b', urgency: 'Medium', status: 'Pending', type: 'Borrow', createdAt: '2026-07-16T10:00:00.000Z' },
  ];
  const prioritized = prioritizeRequests(requests, now);
  const providerA = prioritized.filter((request) => request.providerHospitalId === 'provider-a');
  assert.deepEqual(providerA.map((request) => request.id), ['critical-new', 'low-old', 'high-new']);
  assert.deepEqual(providerA.map((request) => request.queuePosition), [1, 2, 3]);
  assert.equal(providerA[1].effectiveUrgency, 'High');
  assert.equal(prioritized.find((request) => request.id === 'other-provider').queuePosition, 1);
  assert.equal(prioritized.length, requests.length);
});

test('clinical approval order must be followed before admin final approval', async () => {
  await resetDemoData();

  const hospital = registerHospital({
    name: 'Hospital H',
    location: 'West Loop',
    email: 'h@hospital.org',
    password: 'secret123',
    visibility: 'Public',
    type: 'General',
  });

  const state = data.getState();
  state.hospitals = state.hospitals.map((entry) => entry.id === hospital.id ? { ...entry, accountStatus: 'Active' } : entry);
  data.setState(state);

  addResourceListing({
    hospitalId: hospital.id,
    resourceType: 'Supply',
    resourceName: 'Masks',
    quantity: 20,
    availableForBorrow: true,
    availableForOrder: true,
  });

  const request = createResourceRequest({
    requesterHospitalId: 'hospital-demo',
    providerHospitalId: hospital.id,
    resourceName: 'Masks',
    quantity: 4,
    requestType: 'Borrow',
    notes: 'Need masks',
  });

  assert.equal(request.status, 'Pending');
  assert.equal(request.providerApproval, 'Pending');

  assert.throws(() => respondToRequest({
    requestId: request.id,
    responderHospitalId: hospital.id,
    response: 'approve',
    notes: 'Hospital attempted approval too early',
  }), /Pharmacist approval must be completed before hospital approval/);

  assert.throws(() => reviewRequestClinicalStage({
    requestId: request.id,
    reviewerHospitalId: hospital.id,
    reviewerRole: 'Doctor',
    decision: 'approve',
  }), /Pharmacist approval must be recorded before doctor review/);

  assert.throws(() => reviewRequestClinicalStage({
    requestId: request.id,
    reviewerHospitalId: 'hospital-eastbay',
    reviewerRole: 'Pharmacist',
    decision: 'approve',
  }), /must belong to the provider hospital for this request/);

  reviewRequestClinicalStage({
    requestId: request.id,
    reviewerHospitalId: hospital.id,
    reviewerRole: 'Pharmacist',
    decision: 'approve',
  });

  reviewRequestClinicalStage({
    requestId: request.id,
    reviewerHospitalId: hospital.id,
    reviewerRole: 'Doctor',
    decision: 'approve',
  });

  assert.throws(() => approveRequest({
    requestId: request.id,
    approverHospitalId: 'hospital-admin',
  }), /Hospital approval must be completed before admin approval/);
});
