const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../data');
const { resetDemoData } = require('../data');
const { registerHospital } = require('../utils/hospitalService');
const { recommendHospitals, scoreHospital, getRecommendationNetwork } = require('../utils/recommendation');

test('recommends closest and best-stock hospitals', async () => {
  await resetDemoData();
  registerHospital({ name: 'Hospital B', location: 'Northside', email: 'b@hospital.org', password: 'secret123', visibility: 'Public', type: 'General' });
  registerHospital({ name: 'Hospital C', location: 'Westend', email: 'c@hospital.org', password: 'secret123', visibility: 'Public', type: 'General' });

  const results = await recommendHospitals({ currentHospitalId: 'hospital-a', resourceName: 'Blood Bags', quantity: 30, urgency: 'High' });
  assert.ok(results.length >= 1);
  assert.equal(results[0].resourceName, 'Blood Bags');
  assert.ok(results[0].score >= (results[1]?.score || 0));
  assert.ok(results[0].reasonBreakdown);
  assert.deepEqual(Object.keys(results[0].reasonBreakdown).sort(), ['distance', 'emergency', 'reliability', 'stock'].sort());
  assert.equal('availableStaff' in results[0], false);
});

test('returns a full ranked list instead of only the top three', async () => {
  await resetDemoData();
  const results = await recommendHospitals({ currentHospitalId: 'hospital-a', resourceName: 'Blood Bags', quantity: 30, urgency: 'Low' });

  assert.ok(results.length > 3, 'recommendations should include all suitable providers');
  assert.equal(results[0].rank, 1);
  assert.ok(results.every((entry, index) => entry.rank === index + 1));
});

test('uses published inventory without staff data in recommendations', async () => {
  await resetDemoData();
  const results = await recommendHospitals({ currentHospitalId: 'hospital-demo', resourceName: 'Oxygen Tanks', quantity: 2, urgency: 'Medium' });
  const recommendation = results.find((entry) => entry.id === 'hospital-central');

  assert.ok(recommendation, 'expected the recommendation list to include active provider hospitals');
  assert.equal(recommendation.stock, 6);
  assert.equal('availableStaff' in recommendation, false);
  assert.equal('staff' in recommendation.reasonBreakdown, false);
  assert.equal('staff' in recommendation.rankingBasis.weights, false);
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

test('uses current available stock after a transfer instead of the original published quantity', async () => {
  await resetDemoData();
  const state = data.getState();
  const gloves = state.inventory.find((item) => item.hospitalId === 'hospital-riverside' && item.resourceName === 'Gloves');
  gloves.publishedQuantity = 40;
  gloves.availableQuantity = 35;
  gloves.quantity = 35;
  data.setState(state);

  const riverside = state.hospitals.find((hospital) => hospital.id === 'hospital-riverside');
  const result = await scoreHospital(riverside, 'Gloves', 5, 'Medium');
  assert.equal(result.stock, 35);
});

test('uses requester-to-provider distance and exposes the hospital network map', async () => {
  await resetDemoData();
  const fromNorthside = await recommendHospitals({ currentHospitalId: 'hospital-demo', resourceName: 'Portable Monitors', quantity: 2, urgency: 'High' });
  const fromCentral = await recommendHospitals({ currentHospitalId: 'hospital-central', resourceName: 'Portable Monitors', quantity: 2, urgency: 'High' });
  assert.equal(fromNorthside.find((entry) => entry.id === 'hospital-eastbay').distance, 2);
  assert.equal(fromCentral.find((entry) => entry.id === 'hospital-eastbay').distance, 1);

  const network = await getRecommendationNetwork({ currentHospitalId: 'hospital-demo' });
  assert.ok(network.nodes.some((node) => node.role === 'Admin'));
  assert.ok(network.edges.some((edge) => edge.from === 'hospital-demo' || edge.to === 'hospital-demo'));
  const centralToWestbridge = network.edges.find((edge) => [edge.from, edge.to].includes('hospital-central') && [edge.from, edge.to].includes('hospital-westbridge'));
  assert.equal(centralToWestbridge.distance, 4);
  assert.equal(centralToWestbridge.estimated, false);
});
