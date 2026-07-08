const assert = require('assert');
const data = require('../data');
const { registerHospital } = require('../utils/hospitalService');
const { getHospitalByEmail } = require('../sqlite');
const { verifyPassword } = require('../utils/auth');

(async () => {
  await data.initializeState();

  const email = `manual-${Date.now()}@example.com`;
  const password = 'Manual@1234';

  const hospital = registerHospital({
    name: 'Manual Test Hospital',
    location: 'Testville',
    email,
    password,
    visibility: 'Public',
    type: 'General',
  });

  const pendingHospital = await getHospitalByEmail(email);
  assert.ok(pendingHospital, 'Expected the registered hospital to be persisted');
  assert.strictEqual(pendingHospital.accountStatus, 'Pending', 'Newly registered hospitals should require approval first');

  await data.persistHospitalStatus(hospital.id, 'Active');

  const approvedHospital = await getHospitalByEmail(email);
  assert.strictEqual(approvedHospital.accountStatus, 'Active', 'Admin approval should activate the hospital account');
  assert.ok(verifyPassword(password, approvedHospital.password), 'Password verification should succeed for the approved hospital');
  assert.strictEqual(approvedHospital.email, hospital.email);

  console.log('manual registration approval flow test passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
