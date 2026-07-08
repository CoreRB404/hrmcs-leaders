const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDemoData } = require('../data');
const { registerHospital } = require('../utils/hospitalService');
const { recommendHospitals } = require('../utils/recommendation');

test('recommends closest and best-stock hospitals', () => {
  resetDemoData();
  registerHospital({ name: 'Hospital B', location: 'Northside', email: 'b@hospital.org', password: 'secret123', visibility: 'Public', type: 'General' });
  registerHospital({ name: 'Hospital C', location: 'Westend', email: 'c@hospital.org', password: 'secret123', visibility: 'Public', type: 'General' });

  const results = recommendHospitals({ currentHospitalId: 'hospital-a', resourceName: 'Blood Bags', quantity: 30 });
  assert.ok(results.length >= 1);
  assert.equal(results[0].resourceName, 'Blood Bags');
  assert.ok(results[0].score >= (results[1]?.score || 0));
});
