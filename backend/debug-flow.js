const fs = require('fs');
const { resetDemoData } = require('./data');
const { registerHospital, addResourceListing, createResourceRequest, getAdminSummary } = require('./utils/hospitalService');

resetDemoData();
const hospital = registerHospital({
  name: 'Hospital G',
  location: 'North Loop',
  email: 'g@hospital.org',
  password: 'secret123',
  visibility: 'Private',
  type: 'General',
});
addResourceListing({
  hospitalId: hospital.id,
  resourceType: 'Supply',
  resourceName: 'Oxygen Tanks',
  quantity: 40,
  availableForBorrow: true,
  availableForOrder: true,
});
const request = createResourceRequest({
  requesterHospitalId: 'hospital-a',
  providerHospitalId: hospital.id,
  resourceName: 'Oxygen Tanks',
  quantity: 10,
  requestType: 'Borrow',
  notes: 'Emergency support',
});
console.log('request', JSON.stringify(request));
console.log('summary', JSON.stringify(getAdminSummary()));
console.log(fs.readFileSync('./data/database.json', 'utf8'));
