const data = require('../data');
const { hashPassword } = require('./auth');
const { rememberHospitalEmail } = require('../sqlite');

function getInventoryItem(hospitalId, resourceName) {
  return data.getInventory().find((item) => item.hospitalId === hospitalId && item.resourceName.toLowerCase() === resourceName.toLowerCase());
}

const URGENCY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const URGENCY_BY_RANK = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
const AGING_HOURS_PER_LEVEL = 24;

function getRequestPriority(request, now = Date.now()) {
  const urgency = URGENCY_RANK[request.urgency] ? request.urgency : 'Low';
  const createdAt = new Date(request.createdAt).getTime();
  const waitingHours = Number.isFinite(createdAt) ? Math.max(0, Math.floor((now - createdAt) / 3600000)) : 0;
  const agingLevels = Math.floor(waitingHours / AGING_HOURS_PER_LEVEL);
  const effectiveRank = Math.min(URGENCY_RANK.Critical, URGENCY_RANK[urgency] + agingLevels);
  const effectiveUrgency = URGENCY_BY_RANK[effectiveRank];
  return {
    urgency,
    effectiveRank,
    effectiveUrgency,
    waitingHours,
    reason: effectiveUrgency === urgency
      ? `${urgency} urgency, then oldest request first`
      : `${urgency} urgency aged to ${effectiveUrgency} after ${waitingHours} hours`,
  };
}

function prioritizeRequests(requests, now = Date.now()) {
  const pending = requests.filter((request) => request.status === 'Pending');
  const queues = new Map();
  for (const request of pending) {
    const queue = queues.get(request.providerHospitalId) || [];
    queue.push(request);
    queues.set(request.providerHospitalId, queue);
  }

  const priorityById = new Map();
  for (const queue of queues.values()) {
    queue.sort((first, second) => {
      const firstPriority = getRequestPriority(first, now);
      const secondPriority = getRequestPriority(second, now);
      return secondPriority.effectiveRank - firstPriority.effectiveRank
        || new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    });
    queue.forEach((request, index) => {
      priorityById.set(request.id, { ...getRequestPriority(request, now), queuePosition: index + 1, queueSize: queue.length });
    });
  }

  return requests
    .map((request) => ({ ...request, ...(priorityById.get(request.id) || {}) }))
    .sort((first, second) => {
      const firstPending = first.status === 'Pending';
      const secondPending = second.status === 'Pending';
      if (firstPending !== secondPending) return firstPending ? -1 : 1;
      if (firstPending && first.effectiveRank !== second.effectiveRank) return second.effectiveRank - first.effectiveRank;
      return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    });
}

function getMatchingPublishedSupplies(hospitalId, resourceName, requestType = 'Borrow') {
  const normalizedName = String(resourceName || '').trim().toLowerCase();
  const normalizedType = requestType === 'Order' ? 'Order' : 'Borrow';

  return data.getInventory().filter((item) => {
    if (item.status === 'Inactive') return false;
    if (item.hospitalId !== hospitalId || String(item.resourceName || '').trim().toLowerCase() !== normalizedName) {
      return false;
    }
    return normalizedType === 'Order' ? item.availableForOrder : item.availableForBorrow;
  });
}

function validatePublishedSupply(hospitalId, resourceName, quantity, requestType = 'Borrow') {
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    throw new Error('Request quantity must be a positive number');
  }

  const normalizedName = String(resourceName || '').trim().toLowerCase();
  const allNameMatches = data.getInventory().filter((item) => (
    item.hospitalId === hospitalId
    && String(item.resourceName || '').trim().toLowerCase() === normalizedName
  ));
  if (!allNameMatches.length) {
    throw new Error('The selected provider has not published this supply');
  }

  const matchingSupplies = getMatchingPublishedSupplies(hospitalId, resourceName, requestType);
  if (!matchingSupplies.length) {
    throw new Error(`This supply is not published for ${requestType === 'Order' ? 'ordering' : 'borrowing'} by the selected provider`);
  }

  const availableQuantity = matchingSupplies.reduce(
    (total, item) => total + Number(item.availableQuantity ?? item.quantity ?? 0),
    0
  );
  if (numericQuantity > availableQuantity) {
    throw new Error(`Only ${availableQuantity} units are currently available from the selected provider`);
  }

  return { matchingSupplies, availableQuantity, numericQuantity };
}

function commitInventoryItem(hospitalId, resourceName, quantity, requestType = 'Borrow') {
  const inventory = data.getInventory();
  const { matchingSupplies, numericQuantity } = validatePublishedSupply(hospitalId, resourceName, quantity, requestType);
  let remaining = numericQuantity;

  for (const item of matchingSupplies) {
    if (remaining <= 0) break;
    const available = Number(item.availableQuantity ?? item.quantity ?? 0);
    const committed = Math.min(available, remaining);
    item.quantity = Math.max(0, Number(item.quantity ?? available) - committed);
    item.availableQuantity = Math.max(0, available - committed);
    item.lentQuantity = Number(item.lentQuantity || 0) + committed;
    remaining -= committed;
    data.persistInventoryItem(item);
  }

  const state = data.getState();
  state.inventory = inventory;
  data.setState(state);
  return matchingSupplies[0];
}

function registerHospital({ name, location, email, password, visibility, type, emergencyStatus }) {
  const hospitals = data.getHospitals();
  const notifications = data.getNotifications();

  const normalizedName = String(name || '').trim();
  const normalizedLocation = String(location || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const normalizedVisibility = ['Public', 'Private'].includes(visibility) ? visibility : 'Public';
  const normalizedType = ['General', 'Specialist', 'Emergency'].includes(type) ? type : 'General';
  const normalizedEmergencyStatus = emergencyStatus == null ? 'Medium' : emergencyStatus;

  if (normalizedName.length < 2 || normalizedLocation.length < 2) {
    throw new Error('Hospital name and location are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid hospital email is required');
  }
  if (normalizedPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!['Low', 'Medium', 'High'].includes(normalizedEmergencyStatus)) {
    throw new Error('Invalid emergency status');
  }

  // Check for duplicate email
  if (data.emailExistsInMemory(normalizedEmail)) {
    throw new Error('A hospital with this email already exists');
  }

  const hospitalId = `hospital-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hospital = {
    id: hospitalId,
    name: normalizedName,
    location: normalizedLocation,
    email: normalizedEmail,
    password: hashPassword(normalizedPassword),
    visibility: normalizedVisibility,
    type: normalizedType,
    role: 'Hospital',
    accountStatus: 'Pending',
    createdAt: new Date().toISOString(),
    emergencyStatus: normalizedEmergencyStatus,
    capacity: 200,
    availableBeds: 40,
    availableIcu: 6,
    availableAmbulances: 2,
    distance: 0,
  };

  const reviewerCredentials = (() => {
    const [rawLocalPart, rawDomain = 'hrmcs.local'] = normalizedEmail.split('@');
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
  })();

  const reviewerAccounts = reviewerCredentials ? [
    {
      id: `reviewer-${hospitalId}-doctor`,
      hospitalId,
      name: `${normalizedName} Doctor`,
      location: normalizedLocation,
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
      name: `${normalizedName} Pharmacist`,
      location: normalizedLocation,
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
    message: `${normalizedName} registered to the shared hospital network`,
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

async function updateHospitalEmergencyStatus(hospitalId, emergencyStatus) {
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
  await data.persistHospital(hospital);

  return hospital;
}

async function updateHospitalDistance(hospitalId, distance) {
  const hospitals = data.getHospitals();
  const hospital = hospitals.find((entry) => entry.id === hospitalId);

  if (!hospital) {
    throw new Error('Hospital not found');
  }

  const numericDistance = Number(distance);
  if (!Number.isFinite(numericDistance) || numericDistance < 0) {
    throw new Error('Distance must be a non-negative number');
  }

  hospital.distance = numericDistance;
  const state = data.getState();
  state.hospitals = hospitals;
  data.setState(state);
  await data.persistHospital(hospital);
  await data.persistHospitalDistance('hospital-admin', hospital.id, numericDistance);
  return hospital;
}

function addResourceListing({ hospitalId, resourceType, resourceName, quantity, availableForBorrow, availableForOrder }) {
  const inventory = data.getInventory();
  const normalizedResourceName = String(resourceName || '').trim();
  const numericQuantity = Number(quantity);
  if (!normalizedResourceName || !Number.isInteger(numericQuantity) || numericQuantity <= 0) {
    throw new Error('A resource name and positive whole-number quantity are required');
  }
  if (!availableForBorrow && !availableForOrder) {
    throw new Error('A listing must be available for borrowing, ordering, or both');
  }
  const duplicate = inventory.some((item) => item.hospitalId === hospitalId
    && String(item.resourceName || '').trim().toLowerCase() === normalizedResourceName.toLowerCase());
  if (duplicate) {
    throw new Error('This hospital already has a listing for this supply. Edit or reactivate the existing listing instead');
  }
  const listing = {
    id: `listing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hospitalId,
    resourceType: 'Supply',
    resourceName: normalizedResourceName,
    quantity: numericQuantity,
    publishedQuantity: numericQuantity,
    availableQuantity: numericQuantity,
    lentQuantity: 0,
    reserved: 0,
    availableForBorrow,
    availableForOrder,
    status: 'Active',
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

function updateResourceListing({ listingId, hospitalId, resourceName, quantity, availableForBorrow, availableForOrder }) {
  const item = data.getInventory().find((entry) => entry.id === listingId);
  if (!item) throw new Error('Supply listing not found');
  if (item.hospitalId !== hospitalId) throw new Error('You cannot edit another hospital inventory');

  const normalizedResourceName = String(resourceName || '').trim();
  const numericQuantity = Number(quantity);
  if (!normalizedResourceName || !Number.isInteger(numericQuantity) || numericQuantity < 0) {
    throw new Error('A resource name and non-negative whole-number quantity are required');
  }
  if (!availableForBorrow && !availableForOrder) {
    throw new Error('The supply must be available for borrowing, ordering, or both');
  }
  const duplicate = data.getInventory().some((entry) => entry.id !== listingId
    && entry.hospitalId === hospitalId
    && String(entry.resourceName || '').trim().toLowerCase() === normalizedResourceName.toLowerCase());
  if (duplicate) throw new Error('This hospital already has another listing for this supply');

  item.resourceName = normalizedResourceName;
  item.quantity = numericQuantity;
  item.availableQuantity = numericQuantity;
  item.publishedQuantity = numericQuantity + Number(item.lentQuantity || 0);
  item.availableForBorrow = Boolean(availableForBorrow);
  item.availableForOrder = Boolean(availableForOrder);
  data.persistInventoryItem(item);
  return item;
}

function setResourceListingStatus({ listingId, hospitalId, status }) {
  const item = data.getInventory().find((entry) => entry.id === listingId);
  if (!item) throw new Error('Supply listing not found');
  if (item.hospitalId !== hospitalId) throw new Error('You cannot manage another hospital inventory');
  if (!['Active', 'Inactive'].includes(status)) throw new Error('Listing status must be Active or Inactive');
  item.status = status;
  data.persistInventoryItem(item);
  return item;
}

function deleteResourceListing({ listingId, hospitalId }) {
  const inventory = data.getInventory();
  const item = inventory.find((entry) => entry.id === listingId);
  if (!item) throw new Error('Supply listing not found');
  if (item.hospitalId !== hospitalId) throw new Error('You cannot delete another hospital inventory');
  const linkedRequest = data.getRequests().some((request) => request.providerHospitalId === hospitalId
    && String(request.resourceName || '').trim().toLowerCase() === String(item.resourceName || '').trim().toLowerCase());
  if (linkedRequest) throw new Error('This listing has request history and cannot be deleted. Deactivate it instead');
  const state = data.getState();
  state.inventory = inventory.filter((entry) => entry.id !== listingId);
  data.setState(state);
  data.persistInventoryDeletion(listingId);
  return item;
}

function createResourceRequest({ requesterHospitalId, providerHospitalId, resourceName, quantity, requestType, notes, urgency }) {
  const requester = data.getHospitals().find((hospital) => hospital.id === requesterHospitalId);
  if (!requester || requester.role !== 'Hospital' || requester.accountStatus !== 'Active') {
    throw new Error('Requester hospital must be active to create requests');
  }
  if (requesterHospitalId === providerHospitalId) {
    throw new Error('You cannot request resources from your own hospital');
  }
  const provider = data.getHospitals().find((hospital) => hospital.id === providerHospitalId);
  if (!provider || provider.role !== 'Hospital' || provider.accountStatus !== 'Active') {
    throw new Error('Provider hospital must be active to fulfill requests');
  }

  const normalizedRequestType = requestType === 'Order' ? 'Order' : 'Borrow';
  const { matchingSupplies, numericQuantity } = validatePublishedSupply(
    providerHospitalId,
    resourceName,
    quantity,
    normalizedRequestType
  );
  const publishedResourceName = matchingSupplies[0].resourceName;

  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const timestamp = new Date().toISOString();
  const requesterName = data.getHospitals().find((h) => h.id === requesterHospitalId)?.name || requesterHospitalId;
  const providerName = provider.name || providerHospitalId;

  const request = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    requesterHospitalId,
    providerHospitalId,
    resourceName: publishedResourceName,
    quantity: numericQuantity,
    requestType: normalizedRequestType,
    notes,
    urgency: URGENCY_RANK[urgency] ? urgency : 'Low',
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
        note: `${requesterName} requested ${numericQuantity} ${publishedResourceName} from ${providerName}`,
        timestamp,
      },
    ],
    createdAt: timestamp,
    type: normalizedRequestType,
  };

  requests.push(request);
  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `${requesterName} requested ${numericQuantity} ${publishedResourceName} from ${providerName}`,
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

  if (!['approve', 'reject'].includes(response)) {
    throw new Error('Hospital decision must be approve or reject');
  }

  const status = response === 'approve' ? 'Approved' : 'Rejected';
  const responderName = data.getHospitals().find((h) => h.id === responderHospitalId)?.name || responderHospitalId;

  if (status === 'Approved') {
    validatePublishedSupply(request.providerHospitalId, request.resourceName, request.quantity, request.requestType || request.type);
  }
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
  if (!['approve', 'reject'].includes(decision)) {
    throw new Error('Clinical decision must be approve or reject');
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

function reviewAdminRequest({ requestId, approverHospitalId, decision = 'approve', notes }) {
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

  if (!['approve', 'reject'].includes(decision)) {
    throw new Error('Admin decision must be approve or reject');
  }

  if (decision === 'approve') {
    commitInventoryItem(request.providerHospitalId, request.resourceName, request.quantity, request.requestType || request.type);
  }

  request.status = decision === 'approve' ? 'Approved' : 'Rejected';
  request.history = request.history || [];
  request.history.push({
    id: `history-${request.id}-${(request.history?.length || 0) + 1}`,
    status: decision === 'approve' ? 'AdminApproved' : 'AdminRejected',
    note: notes || `Admin ${decision === 'approve' ? 'approved' : 'rejected'} request ${requestId}`,
    timestamp: new Date().toISOString(),
  });

  const state = data.getState();
  state.requests = requests;
  state.notifications = notifications;
  notifications.unshift({
    id: `notif-${Date.now()}`,
    message: `Admin ${decision === 'approve' ? 'approved' : 'rejected'} request ${requestId}`,
    severity: decision === 'approve' ? 'Medium' : 'Low',
    timestamp: new Date().toISOString(),
  });
  data.setState(state);

  // Persist to SQLite
  data.persistRequestUpdate(request);

  return request;
}

function approveRequest({ requestId, approverHospitalId }) {
  return reviewAdminRequest({ requestId, approverHospitalId, decision: 'approve' });
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
  const requests = data.getRequests();
  const notifications = data.getNotifications();
  const deletedHospital = hospitals.find((hospital) => hospital.id === hospitalId);

  if (!deletedHospital) {
    throw new Error('Hospital not found');
  }
  if (deletedHospital.role !== 'Hospital') {
    throw new Error('Only hospital accounts can be deleted through hospital management');
  }

  const nextHospitals = hospitals.filter((hospital) => hospital.id !== hospitalId && hospital.hospitalId !== hospitalId);
  const nextInventory = inventory.filter((item) => item.hospitalId !== hospitalId);
  const nextRequests = requests.filter((request) => request.requesterHospitalId !== hospitalId && request.providerHospitalId !== hospitalId && request.hospitalId !== hospitalId);

  const state = data.getState();
  state.hospitals = nextHospitals;
  state.inventory = nextInventory;
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

  return { deletedHospital, nextHospitals, nextInventory, nextRequests };
}

module.exports = {
  registerHospital,
  updateHospitalEmergencyStatus,
  updateHospitalDistance,
  addResourceListing,
  updateResourceListing,
  setResourceListingStatus,
  deleteResourceListing,
  createResourceRequest,
  respondToRequest,
  reviewRequestClinicalStage,
  approveRequest,
  reviewAdminRequest,
  getAdminSummary,
  deleteHospitalAccount,
  resetDemoData: data.resetDemoData,
  prioritizeRequests,
  getRequestPriority,
  validatePublishedSupply,
};
