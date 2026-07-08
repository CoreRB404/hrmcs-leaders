const data = require('../data');
const { hashPassword } = require('./auth');

function getInventoryItem(hospitalId, resourceName) {
  return data.getInventory().find((item) => item.hospitalId === hospitalId && item.resourceName.toLowerCase() === resourceName.toLowerCase());
}

function reserveInventoryItem(hospitalId, resourceName, quantity) {
  const inventory = data.getInventory();
  const item = inventory.find((it) => it.hospitalId === hospitalId && it.resourceName.toLowerCase() === resourceName.toLowerCase());
  if (!item) {
    throw new Error('Resource not found at the selected provider');
  }

  const reserved = item.reserved || 0;
  const available = (item.availableQuantity ?? item.quantity) - reserved;
  if (quantity > available) {
    throw new Error('Not enough inventory available to reserve');
  }

  item.reserved = reserved + quantity;
  item.availableQuantity = Math.max(0, (item.availableQuantity ?? item.quantity) - quantity);
  item.lentQuantity = (item.lentQuantity || 0) + quantity;
  const state = data.getState();
  state.inventory = inventory;
  data.setState(state);
  return item;
}

function finalizeInventoryReservation(request) {
  if (!request.resourceName) return;
  const inventory = data.getInventory();
  const item = inventory.find((it) => it.hospitalId === request.providerHospitalId && it.resourceName.toLowerCase() === request.resourceName.toLowerCase());
  if (!item) {
    return;
  }

  item.quantity = Math.max(0, (item.quantity || item.publishedQuantity || 0) - request.quantity);
  item.availableQuantity = item.quantity;
  item.reserved = Math.max(0, (item.reserved || 0) - request.quantity);

  const state = data.getState();
  state.inventory = inventory;
  data.setState(state);
}

function releaseInventoryReservation(request) {
  if (!request.resourceName) return;
  const inventory = data.getInventory();
  const item = inventory.find((it) => it.hospitalId === request.providerHospitalId && it.resourceName.toLowerCase() === request.resourceName.toLowerCase());
  if (!item) {
    return;
  }

  item.availableQuantity = Math.min(item.publishedQuantity ?? item.quantity, (item.availableQuantity ?? item.quantity) + request.quantity);
  item.reserved = Math.max(0, (item.reserved || 0) - request.quantity);
  const state = data.getState();
  state.inventory = inventory;
  data.setState(state);
}

function registerHospital({ name, location, email, password, visibility, type, role = 'Hospital' }) {
  const hospitals = data.getHospitals();
  const notifications = data.getNotifications();

  // Check for duplicate email
  if (data.emailExistsInMemory(email)) {
    throw new Error('A hospital with this email already exists');
  }

  const hospital = {
    id: `hospital-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    location,
    email,
    password: hashPassword(password),
    visibility,
    type,
    role,
    accountStatus: 'Pending',
    createdAt: new Date().toISOString(),
    emergencyStatus: 'Medium',
    capacity: 200,
    availableBeds: 40,
    availableIcu: 6,
    availableAmbulances: 2,
    distance: 0,
  };

  hospitals.push(hospital);
  const state = data.getState();
  state.hospitals = hospitals;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `${name} registered to the shared hospital network`,
    severity: 'High',
    timestamp: new Date().toISOString(),
  });
  data.setState(state);

  // Persist to SQLite
  data.persistHospital(hospital);

  return hospital;
}

function addResourceListing({ hospitalId, resourceType, resourceName, quantity, availableForBorrow, availableForOrder }) {
  const inventory = data.getInventory();
  const listing = {
    id: `listing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hospitalId,
    resourceType,
    resourceName,
    quantity,
    publishedQuantity: quantity,
    availableQuantity: quantity,
    lentQuantity: 0,
    reserved: 0,
    availableForBorrow,
    availableForOrder,
    status: 'Listed',
    minimumThreshold: 5,
  };

  inventory.push(listing);
  const state = data.getState();
  state.inventory = inventory;
  data.setState(state);
  return listing;
}

function createResourceRequest({ requesterHospitalId, providerHospitalId, resourceName, quantity, requestType, notes }) {
  const provider = data.getHospitals().find((hospital) => hospital.id === providerHospitalId);
  if (!provider || provider.accountStatus !== 'Active') {
    throw new Error('Provider hospital must be active to fulfill requests');
  }

  const item = getInventoryItem(providerHospitalId, resourceName);
  if (item && item.availableForBorrow) {
    // Provider has the item listed — reserve inventory
    reserveInventoryItem(providerHospitalId, resourceName, quantity);
  }
  // If item is not listed, proceed anyway as a general resource request

  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const timestamp = new Date().toISOString();
  const requesterName = data.getHospitals().find((h) => h.id === requesterHospitalId)?.name || requesterHospitalId;
  const providerName = provider.name || providerHospitalId;

  const request = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requesterHospitalId,
    providerHospitalId,
    resourceName,
    quantity,
    requestType,
    notes,
    status: 'Pending',
    providerApproval: 'Pending',
    providerResponseNotes: '',
    history: [
      {
        id: `history-${Date.now()}-1`,
        status: 'Requested',
        note: `${requesterName} requested ${quantity} ${resourceName} from ${providerName}`,
        timestamp,
      },
    ],
    createdAt: timestamp,
    type: requestType || 'Borrow',
  };

  requests.push(request);
  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `${requesterName} requested ${quantity} ${resourceName} from ${providerName}`,
    severity: 'High',
    timestamp,
  });
  data.setState(state);

  // Persist to SQLite
  data.persistRequest(request);

  return request;
}

function respondToRequest({ requestId, responderHospitalId, response, notes }) {
  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const request = requests.find((entry) => entry.id === requestId);
  if (!request) {
    throw new Error('Request not found');
  }
  if (request.providerHospitalId !== responderHospitalId) {
    throw new Error('Not authorized to respond to this request');
  }

  const status = response === 'approve' ? 'Approved' : 'Rejected';
  const responderName = data.getHospitals().find((h) => h.id === responderHospitalId)?.name || responderHospitalId;

  request.providerApproval = status;
  request.providerResponseNotes = notes || '';
  request.history = request.history || [];
  request.history.push({
    id: `history-${request.id}-${request.history.length + 1}`,
    status,
    note: notes || `${responderName} ${status.toLowerCase()} the request`,
    timestamp: new Date().toISOString(),
  });

  if (status === 'Rejected') {
    releaseInventoryReservation(request);
    request.status = 'Rejected';
  }

  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `${responderName} ${status.toLowerCase()} request ${requestId} for ${request.resourceName}`,
    severity: status === 'Approved' ? 'Medium' : 'Low',
    timestamp: new Date().toISOString(),
  });
  data.setState(state);

  // Persist to SQLite
  data.persistRequestUpdate(request);

  return request;
}

function approveRequest({ requestId, approverHospitalId }) {
  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const request = requests.find((entry) => entry.id === requestId);
  if (!request) {
    throw new Error('Request not found');
  }

  if (request.status !== 'Pending') {
    throw new Error('Only pending requests can be approved by admin');
  }

  if (request.providerApproval !== 'Approved') {
    request.providerApproval = 'Approved';
    request.history = request.history || [];
    request.history.push({
      id: `history-${request.id}-${(request.history?.length || 0) + 1}`,
      status: 'ProviderAutoApproved',
      note: `Provider approval auto-recorded for admin review`,
      timestamp: new Date().toISOString(),
    });
  }

  request.status = 'Approved';
  request.history = request.history || [];
  request.history.push({
    id: `history-${request.id}-${(request.history?.length || 0) + 1}`,
    status: 'AdminApproved',
    note: `Admin approved request ${requestId}`,
    timestamp: new Date().toISOString(),
  });

  finalizeInventoryReservation(request);

  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `Admin approved request ${requestId}`,
    severity: 'Medium',
    timestamp: new Date().toISOString(),
  });
  data.setState(state);

  // Persist to SQLite
  data.persistRequestUpdate(request);

  return request;
}

function addStaffEntry({ hospitalId, role, status, count }) {
  const staff = data.getStaff();
  const notifications = data.getNotifications();
  const entry = {
    id: `staff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hospitalId,
    role,
    status,
    count,
    publishedCount: count,
    deployedCount: status === 'Deployed' ? count : 0,
    availableCount: status === 'Available' || status === 'Deployable' ? count : 0,
    createdAt: new Date().toISOString(),
  };

  staff.push(entry);
  const totalAvailable = staff
    .filter((member) => member.hospitalId === hospitalId && (member.status === 'Available' || member.status === 'Deployable'))
    .reduce((sum, item) => sum + item.count, 0);

  const state = data.getState();
  state.staff = staff;
  state.notifications = notifications;
  if (totalAvailable < 3) {
    state.notifications = [{
      id: `notif-${Date.now()}`,
      message: `${hospitalId} has low available staff (${totalAvailable}), please update staffing levels`,
      severity: 'High',
    }, ...notifications];
  }
  data.setState(state);
  return entry;
}

function createPatientSupportRequest({ hospitalId, providerHospitalId, patientType, need, priority, notes }) {
  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const hospitalName = data.getHospitals().find((h) => h.id === hospitalId)?.name || hospitalId;
  const supportRequest = {
    id: `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hospitalId, // original creator
    requesterHospitalId: hospitalId, // compatibility with request tracking
    providerHospitalId: providerHospitalId || null,
    patientType,
    need,
    priority,
    notes,
    status: providerHospitalId ? 'Pending' : 'Open',
    providerApproval: providerHospitalId ? 'Pending' : undefined,
    createdAt: new Date().toISOString(),
    type: 'PatientSupport',
  };

  requests.push(supportRequest);
  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `${hospitalName} logged a ${priority.toLowerCase()} patient-support need: ${need}`,
    severity: priority === 'High' ? 'High' : 'Medium',
  });
  data.setState(state);

  // Persist to SQLite
  data.persistRequest(supportRequest);

  return supportRequest;
}

function getAdminSummary() {
  const hospitals = data.getHospitals();
  const inventory = data.getInventory();
  const requests = data.getRequests();
  const notifications = data.getNotifications();

  return {
    totalHospitals: hospitals.length,
    totalInventoryItems: inventory.length,
    totalTransactions: requests.filter((request) => ['Pending', 'Approved', 'Open'].includes(request.status)).length,
    pendingRequests: requests.filter((request) => request.status === 'Pending').length,
    approvedRequests: requests.filter((request) => request.status === 'Approved').length,
    pendingProviderApprovals: requests.filter((request) => request.providerApproval === 'Pending' && request.status === 'Pending').length,
    pendingAdminApprovals: requests.filter((request) => request.providerApproval === 'Approved' && request.status === 'Pending').length,
    pendingHospitalApprovals: hospitals.filter((hospital) => hospital.accountStatus === 'Pending').length,
    latestNotifications: notifications.slice(0, 5),
  };
}

function deleteHospitalAccount(hospitalId) {
  const hospitals = data.getHospitals();
  const inventory = data.getInventory();
  const staff = data.getStaff();
  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const deletedHospital = hospitals.find((hospital) => hospital.id === hospitalId);

  if (!deletedHospital) {
    throw new Error('Hospital not found');
  }

  const nextHospitals = hospitals.filter((hospital) => hospital.id !== hospitalId);
  const nextInventory = inventory.filter((item) => item.hospitalId !== hospitalId);
  const nextStaff = staff.filter((entry) => entry.hospitalId !== hospitalId);
  const nextRequests = requests.filter((request) => request.requesterHospitalId !== hospitalId && request.providerHospitalId !== hospitalId && request.hospitalId !== hospitalId);

  const state = data.getState();
  state.hospitals = nextHospitals;
  state.inventory = nextInventory;
  state.staff = nextStaff;
  state.requests = nextRequests;
  state.notifications = [{
    id: `notif-${Date.now()}`,
    message: `Admin removed hospital account ${deletedHospital.name}`,
    severity: 'High',
    timestamp: new Date().toISOString(),
  }, ...notifications];
  data.setState(state);

  // Persist to SQLite
  data.persistHospitalDeletion(hospitalId);

  return { deletedHospital, nextHospitals, nextInventory, nextStaff, nextRequests };
}

module.exports = {
  registerHospital,
  addResourceListing,
  createResourceRequest,
  respondToRequest,
  approveRequest,
  addStaffEntry,
  createPatientSupportRequest,
  getAdminSummary,
  deleteHospitalAccount,
  resetDemoData: data.resetDemoData,
};
