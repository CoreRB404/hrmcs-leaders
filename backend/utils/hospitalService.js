const data = require('../data');
const { hashPassword } = require('./auth');
const { rememberHospitalEmail } = require('../sqlite');

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
  data.persistInventoryItem(item);
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
  data.persistInventoryItem(item);
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
  data.persistInventoryItem(item);
}

function registerHospital({ name, location, email, password, visibility, type, role = 'Hospital', emergencyStatus }) {
  const hospitals = data.getHospitals();
  const notifications = data.getNotifications();

  // Check for duplicate email
  if (data.emailExistsInMemory(email)) {
    throw new Error('A hospital with this email already exists');
  }

  const normalizedEmergencyStatus = emergencyStatus == null ? 'Medium' : emergencyStatus;

  const hospitalId = `hospital-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hospital = {
    id: hospitalId,
    name,
    location,
    email,
    password: hashPassword(password),
    visibility,
    type,
    role,
    accountStatus: 'Pending',
    createdAt: new Date().toISOString(),
    emergencyStatus: normalizedEmergencyStatus,
    capacity: 200,
    availableBeds: 40,
    availableIcu: 6,
    availableAmbulances: 2,
    distance: 0,
  };

  const reviewerCredentials = role === 'Hospital' ? (() => {
    const [rawLocalPart, rawDomain = 'hrmcs.local'] = String(email).toLowerCase().split('@');
    const localPart = rawLocalPart.replace(/[^a-z0-9._-]/g, '') || 'hospital';
    const domain = rawDomain.replace(/[^a-z0-9.-]/g, '') || 'hrmcs.local';
    const uniqueKey = hospitalId.split('-').pop();
    return {
      doctor: {
        email: `doctor.${localPart}.${uniqueKey}@${domain}`,
        password: 'Doctor@1234',
      },
      pharmacist: {
        email: `pharmacist.${localPart}.${uniqueKey}@${domain}`,
        password: 'Pharmacist@1234',
      },
    };
  })() : null;

  const reviewerAccounts = reviewerCredentials ? [
    {
      id: `reviewer-${hospitalId}-doctor`,
      hospitalId,
      name: `${name} Doctor`,
      location,
      email: reviewerCredentials.doctor.email,
      password: hashPassword(reviewerCredentials.doctor.password),
      visibility: 'Private',
      type: 'Clinical',
      role: 'Doctor',
      accountStatus: 'Pending',
      createdAt: hospital.createdAt,
      emergencyStatus: normalizedEmergencyStatus,
      capacity: 0,
      availableBeds: 0,
      availableIcu: 0,
      availableAmbulances: 0,
      distance: 0,
    },
    {
      id: `reviewer-${hospitalId}-pharmacist`,
      hospitalId,
      name: `${name} Pharmacist`,
      location,
      email: reviewerCredentials.pharmacist.email,
      password: hashPassword(reviewerCredentials.pharmacist.password),
      visibility: 'Private',
      type: 'Pharmacy',
      role: 'Pharmacist',
      accountStatus: 'Pending',
      createdAt: hospital.createdAt,
      emergencyStatus: normalizedEmergencyStatus,
      capacity: 0,
      availableBeds: 0,
      availableIcu: 0,
      availableAmbulances: 0,
      distance: 0,
    },
  ] : [];

  hospitals.push(hospital, ...reviewerAccounts);
  rememberHospitalEmail(hospital);
  reviewerAccounts.forEach(rememberHospitalEmail);
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
  reviewerAccounts.forEach((reviewer) => data.persistHospital(reviewer));

  const { password: passwordHash, ...publicHospital } = hospital;
  return { ...publicHospital, reviewerCredentials };
}

function updateHospitalEmergencyStatus(hospitalId, emergencyStatus) {
  const hospitals = data.getHospitals();
  const notifications = data.getNotifications();
  const hospital = hospitals.find((entry) => entry.id === hospitalId);

  if (!hospital) {
    throw new Error('Hospital not found');
  }

  const validStatuses = ['Low', 'Medium', 'High'];
  if (!validStatuses.includes(emergencyStatus)) {
    throw new Error('Invalid emergency status');
  }

  hospital.emergencyStatus = emergencyStatus;

  const state = data.getState();
  state.hospitals = hospitals;
  state.notifications = [{
    id: `notif-${Date.now()}`,
    message: `${hospital.name} emergency status updated to ${emergencyStatus}`,
    severity: 'Medium',
    timestamp: new Date().toISOString(),
  }, ...notifications];
  data.setState(state);
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
    createdAt: new Date().toISOString(),
  };

  inventory.push(listing);
  const state = data.getState();
  state.inventory = inventory;
  data.setState(state);
  data.persistInventoryItem(listing);
  return listing;
}

function createResourceRequest({ requesterHospitalId, providerHospitalId, resourceName, quantity, requestType, notes, urgency }) {
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
    urgency: urgency || 'Low',
    status: 'Pending',
    providerApproval: 'Pending',
    pharmacistApproval: 'Pending',
    doctorApproval: 'Pending',
    providerResponseNotes: '',
    pharmacistApprovalNotes: '',
    doctorApprovalNotes: '',
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
  if (request.status !== 'Pending') {
    throw new Error('Only pending requests can be responded to by the provider hospital');
  }
  if (request.pharmacistApproval !== 'Approved') {
    throw new Error('Pharmacist approval must be completed before hospital approval');
  }
  if (request.doctorApproval !== 'Approved') {
    throw new Error('Doctor approval must be completed before hospital approval');
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

function reviewRequestClinicalStage({ requestId, reviewerHospitalId, reviewerRole, decision, notes }) {
  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const request = requests.find((entry) => entry.id === requestId);
  if (!request) {
    throw new Error('Request not found');
  }
  if (request.status !== 'Pending') {
    throw new Error('Only pending requests can move through clinical review');
  }
  if (reviewerRole === 'Pharmacist') {
    if (request.providerHospitalId !== reviewerHospitalId) {
      throw new Error('Pharmacist must belong to the provider hospital for this request');
    }
    if (request.pharmacistApproval !== 'Pending') {
      throw new Error('Pharmacist approval has already been recorded for this request');
    }
    if (request.providerApproval !== 'Pending') {
      throw new Error('Hospital approval must be completed after clinical review');
    }
    if (request.doctorApproval !== 'Pending') {
      throw new Error('Doctor approval must be completed after pharmacist review for this request');
    }
    request.pharmacistApproval = decision === 'approve' ? 'Approved' : 'Rejected';
    request.pharmacistApprovalNotes = notes || '';
    request.history.push({
      id: `history-${request.id}-${request.history.length + 1}`,
      status: request.pharmacistApproval,
      note: `Pharmacist ${request.pharmacistApproval.toLowerCase()} the request${notes ? `: ${notes}` : ''}`,
      timestamp: new Date().toISOString(),
    });
    if (request.pharmacistApproval === 'Rejected') {
      request.status = 'Rejected';
      request.doctorApproval = 'Rejected';
      request.providerApproval = 'Rejected';
      releaseInventoryReservation(request);
    }
  } else if (reviewerRole === 'Doctor') {
    if (request.providerHospitalId !== reviewerHospitalId) {
      throw new Error('Doctor must belong to the provider hospital for this request');
    }
    if (request.pharmacistApproval !== 'Approved') {
      throw new Error('Pharmacist approval must be recorded before doctor review can proceed');
    }
    if (request.doctorApproval !== 'Pending') {
      throw new Error('Doctor approval has already been recorded for this request');
    }
    if (request.providerApproval !== 'Pending') {
      throw new Error('Hospital approval must be completed after doctor review');
    }
    request.doctorApproval = decision === 'approve' ? 'Approved' : 'Rejected';
    request.doctorApprovalNotes = notes || '';
    request.history.push({
      id: `history-${request.id}-${request.history.length + 1}`,
      status: request.doctorApproval,
      note: `Doctor ${request.doctorApproval.toLowerCase()} the request${notes ? `: ${notes}` : ''}`,
      timestamp: new Date().toISOString(),
    });
    if (request.doctorApproval === 'Rejected') {
      request.status = 'Rejected';
      request.providerApproval = 'Rejected';
      releaseInventoryReservation(request);
    }
  } else {
    throw new Error('Reviewer role is not supported for clinical approval');
  }

  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `${reviewerRole} ${decision === 'approve' ? 'approved' : 'rejected'} request ${requestId} for ${request.resourceName}`,
    severity: decision === 'approve' ? 'Medium' : 'Low',
    timestamp: new Date().toISOString(),
  });
  data.setState(state);
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
  if (request.pharmacistApproval !== 'Approved') {
    throw new Error('Pharmacist approval must be completed before admin approval');
  }
  if (request.doctorApproval !== 'Approved') {
    throw new Error('Doctor approval must be completed before admin approval');
  }
  if (request.providerApproval !== 'Approved') {
    throw new Error('Hospital approval must be completed before admin approval');
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
  data.persistStaffEntry(entry);
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
  const hospitals = data.getHospitals().filter((hospital) => hospital.role === 'Hospital');
  const inventory = data.getInventory();
  const requests = data.getRequests();
  const notifications = data.getNotifications();

  return {
    totalHospitals: hospitals.length,
    totalInventoryItems: inventory.length,
    totalTransactions: requests.filter((request) => ['Pending', 'Approved', 'Open'].includes(request.status)).length,
    pendingRequests: requests.filter((request) => request.status === 'Pending').length,
    approvedRequests: requests.filter((request) => request.status === 'Approved').length,
    pendingPharmacistApprovals: requests.filter((request) => request.pharmacistApproval === 'Pending' && request.status === 'Pending').length,
    pendingDoctorApprovals: requests.filter((request) => request.pharmacistApproval === 'Approved' && request.doctorApproval === 'Pending' && request.status === 'Pending').length,
    pendingProviderApprovals: requests.filter((request) => request.pharmacistApproval === 'Approved' && request.doctorApproval === 'Approved' && request.providerApproval === 'Pending' && request.status === 'Pending').length,
    pendingAdminApprovals: requests.filter((request) => request.providerApproval === 'Approved' && request.pharmacistApproval === 'Approved' && request.doctorApproval === 'Approved' && request.status === 'Pending').length,
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

  const nextHospitals = hospitals.filter((hospital) => hospital.id !== hospitalId && hospital.hospitalId !== hospitalId);
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
  reviewRequestClinicalStage,
  approveRequest,
  addStaffEntry,
  createPatientSupportRequest,
  getAdminSummary,
  deleteHospitalAccount,
  resetDemoData: data.resetDemoData,
};
