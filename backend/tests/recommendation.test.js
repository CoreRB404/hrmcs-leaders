const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data');
const { resetDemoData } = require('../data');
const { registerHospital } = require('../utils/hospitalService');
const { recommendHospitals, scoreHospital } = require('../utils/recommendation');

test('recommends closest and best-stock hospitals', async () => {
  await resetDemoData();
  registerHospital({ name: 'Hospital B', location: 'Northside', email: 'b@hospital.org', password: 'secret123', visibility: 'Public', type: 'General' });
  registerHospital({ name: 'Hospital C', location: 'Westend', email: 'c@hospital.org', password: 'secret123', visibility: 'Public', type: 'General' });

  const results = await recommendHospitals({ currentHospitalId: 'hospital-a', resourceName: 'Blood Bags', quantity: 30, urgency: 'High' });
  assert.ok(results.length >= 1);
  assert.equal(results[0].resourceName, 'Blood Bags');
  assert.ok(results[0].score >= (results[1]?.score || 0));
  assert.ok(results[0].reasonBreakdown);
  assert.deepEqual(Object.keys(results[0].reasonBreakdown).sort(), ['distance', 'emergency', 'reliability', 'staff', 'stock'].sort());
});

test('returns a full ranked list instead of only the top three', async () => {
  await resetDemoData();
  const results = await recommendHospitals({ currentHospitalId: 'hospital-a', resourceName: 'Blood Bags', quantity: 30, urgency: 'Low' });

  assert.ok(results.length > 3, 'recommendations should include all suitable providers');
  assert.equal(results[0].rank, 1);
  assert.ok(results.every((entry, index) => entry.rank === index + 1));
});

test('uses published inventory and total available staff counts in recommendations', async () => {
  await resetDemoData();
  const results = await recommendHospitals({ currentHospitalId: 'hospital-demo', resourceName: 'Oxygen Tanks', quantity: 2, urgency: 'Medium' });
  const recommendation = results.find((entry) => entry.id === 'hospital-central');

  assert.ok(recommendation, 'expected the recommendation list to include active provider hospitals');
  assert.equal(recommendation.stock, 6);
  assert.equal(recommendation.availableStaff, 14);
});

test('does not rely on a hardcoded hospital id when context is missing', async () => {
  await resetDemoData();
  const results = await recommendHospitals({ resourceName: 'Blood Bags', quantity: 30, urgency: 'Low' });

  assert.ok(results.every((entry) => entry.id !== 'hospital-admin'));
});

test('tie-breaks equal scores by distance then stock', async () => {
  await resetDemoData();
  const state = data.getState();
  const hospitals = state.hospitals.map((entry) => {
    if (entry.id === 'hospital-demo') {
      return { ...entry, distance: 8, emergencyStatus: 'Low', stock: 4 };
    }
    if (entry.id === 'hospital-central') {
      return { ...entry, distance: 8, emergencyStatus: 'Low', stock: 6 };
    }
    return entry;
  });
  state.hospitals = hospitals;
  data.setState(state);

  const demoScore = await scoreHospital(state.hospitals.find((h) => h.id === 'hospital-demo'), 'Blood Bags', 30, 'Low');
  const centralScore = await scoreHospital(state.hospitals.find((h) => h.id === 'hospital-central'), 'Blood Bags', 30, 'Low');

  assert.ok(Math.abs(demoScore.score - centralScore.score) < 0.01);
  assert.equal(demoScore.distance, 8);
  assert.equal(centralScore.distance, 8);
  assert.ok(demoScore.reasonBreakdown.distance >= 0);
  assert.ok(centralScore.reasonBreakdown.distance >= 0);
});
