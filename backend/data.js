const {
  seedDefaultUsers,
  resetSeedState,
  getHospitals: getSqliteHospitals,
  getInventory: getSqliteInventory,
  getRequests: getSqliteRequests,
  getNotifications: getSqliteNotifications,
  getHospitalDistances: getSqliteHospitalDistances,
  insertHospital: sqliteInsertHospital,
  upsertInventoryItem: sqliteUpsertInventoryItem,
  deleteInventoryItem: sqliteDeleteInventoryItem,
  upsertHospitalDistance: sqliteUpsertHospitalDistance,
  updateHospitalStatus: sqliteUpdateHospitalStatus,
  updateHospitalAccount: sqliteUpdateHospitalAccount,
  deleteHospitalById: sqliteDeleteHospitalById,
  insertRequest: sqliteInsertRequest,
  updateRequest: sqliteUpdateRequest,
  checkEmailExists: sqliteCheckEmailExists,
} = require('./sqlite');

let state = { hospitals: [], inventory: [], requests: [], notifications: [] };
let initialized = false;
let initializationPromise = null;

async function initializeState() {
  if (initialized && state.hospitals.length) {
    return state;
  }

  if (!initializationPromise) {
    initializationPromise = (async () => {
      await seedDefaultUsers();
      const [hospitals, inventory, requests, notifications] = await Promise.all([
        getSqliteHospitals(),
        getSqliteInventory(),
        getSqliteRequests(),
        getSqliteNotifications(),
      ]);

      state = { hospitals, inventory, requests, notifications };
      initialized = true;
      return state;
    })();
  }

  try {
    return await initializationPromise;
  } finally {
    if (initialized) {
      initializationPromise = null;
    }
  }
}

function getState() {
  return state;
}

function saveState() {
  return state;
}

async function resetDemoData() {
  initialized = false;
  initializationPromise = null;
  state = { hospitals: [], inventory: [], requests: [], notifications: [] };
  await resetSeedState();
  await seedDefaultUsers({ force: true });

  const [hospitals, inventory, requests, notifications] = await Promise.all([
    getSqliteHospitals(),
    getSqliteInventory(),
    getSqliteRequests(),
    getSqliteNotifications(),
  ]);
  state = { hospitals, inventory, requests, notifications };
  initialized = true;
  return state;
}

function getHospitals() {
  return state.hospitals;
}

function getInventory() {
  return state.inventory;
}

function getRequests() {
  return state.requests;
}

function getNotifications() {
  return state.notifications;
}

function setState(nextDb) {
  state = nextDb;
  initialized = true;
  return state;
}

// Look up a hospital by email in the in-memory state (for login of newly registered hospitals)
function getHospitalByEmailFromMemory(email) {
  return state.hospitals.find((h) => h.email === email) || null;
}

// Check if email already exists (in-memory check)
function emailExistsInMemory(email) {
  return state.hospitals.some((h) => h.email === email);
}

// Write-through: persist hospital registration to both memory and SQLite
async function persistHospital(hospital) {
  try {
    await sqliteInsertHospital(hospital);
  } catch (err) {
    console.error('Failed to persist hospital to SQLite', err);
  }
}

async function persistInventoryItem(item) {
  try {
    await sqliteUpsertInventoryItem(item);
  } catch (err) {
    console.error('Failed to persist inventory item to SQLite', err);
  }
}

async function persistInventoryDeletion(itemId) {
  await sqliteDeleteInventoryItem(itemId);
}

async function persistHospitalDistance(fromHospitalId, toHospitalId, distance) {
  await sqliteUpsertHospitalDistance(fromHospitalId, toHospitalId, distance);
}

// Write-through: persist hospital status change to SQLite
async function persistHospitalStatus(hospitalId, accountStatus) {
  try {
    await sqliteUpdateHospitalStatus(hospitalId, accountStatus);
  } catch (err) {
    console.error('Failed to persist hospital status to SQLite', err);
  }
}

async function persistHospitalAccount(account) {
  await sqliteUpdateHospitalAccount(account);
}

// Write-through: persist hospital deletion to SQLite
async function persistHospitalDeletion(hospitalId) {
  try {
    await sqliteDeleteHospitalById(hospitalId);
  } catch (err) {
    console.error('Failed to persist hospital deletion to SQLite', err);
  }
}

// Write-through: persist a new request to SQLite
async function persistRequest(request) {
  try {
    await sqliteInsertRequest(request);
  } catch (err) {
    console.error('Failed to persist request to SQLite', err);
  }
}

// Write-through: persist request status updates to SQLite
async function persistRequestUpdate(request) {
  try {
    await sqliteUpdateRequest(request);
  } catch (err) {
    console.error('Failed to persist request update to SQLite', err);
  }
}

// Check email uniqueness across both memory and SQLite
async function checkEmailUnique(email) {
  if (emailExistsInMemory(email)) {
    return false;
  }
  const existsInDb = await sqliteCheckEmailExists(email);
  return !existsInDb;
}

initializeState().catch((error) => {
  console.error('Failed to initialize data cache', error);
});

module.exports = {
  initializeState,
  getState,
  saveState,
  getHospitals,
  getInventory,
  getRequests,
  getNotifications,
  getHospitalDistances: getSqliteHospitalDistances,
  setState,
  resetDemoData,
  // New helpers
  getHospitalByEmailFromMemory,
  emailExistsInMemory,
  persistHospital,
  persistInventoryItem,
  persistInventoryDeletion,
  persistHospitalDistance,
  persistHospitalStatus,
  persistHospitalAccount,
  persistHospitalDeletion,
  persistRequest,
  persistRequestUpdate,
  checkEmailUnique,
};
