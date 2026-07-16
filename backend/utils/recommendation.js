const data = require('../data');

const STOCK_WEIGHT = 0.5;
const STAFF_WEIGHT = 0.15;
const EMERGENCY_WEIGHT = 0.15;
const DISTANCE_WEIGHT = 0.1;
const RELIABILITY_WEIGHT = 0.1;
const URGENCY_WEIGHT = 0.1;
const MAX_SCORE = 5;
const DISTANCE_NORMALIZATION = 10;
const STOCK_SCORE_CAP = 5;
const STAFF_SCORE_CAP = 5;
const RELIABILITY_SCORE_CAP = 5;
const EMERGENCY_SCORE_LOOKUP = {
  High: 5,
  Medium: 3,
  Low: 2,
};
const URGENCY_PRIORITY = {
  Critical: 3,
  High: 2,
  Medium: 1,
  Low: 0,
};

function getState() {
  return {
    hospitals: data.getHospitals(),
    inventory: data.getInventory(),
    staff: data.getStaff(),
    requests: data.getRequests(),
  };
}

function normalizeDistance(distance) {
  const numericDistance = Number(distance || 0);
  if (!Number.isFinite(numericDistance) || numericDistance <= 0) {
    return 1;
  }
  return Math.max(0.1, Math.min(1, 1 / (numericDistance / DISTANCE_NORMALIZATION + 1)));
}

function getReliabilityScore(hospitalId, requests) {
  const hospitalRequests = requests.filter((entry) => entry.providerHospitalId === hospitalId && entry.history?.length);
  if (!hospitalRequests.length) {
    return 0.5;
  }

  const rates = hospitalRequests.map((request) => {
    const history = request.history || [];
    const requestedTime = history.find((entry) => entry.status === 'Requested')?.timestamp;
    const decisionTime = history.find((entry) => entry.status === 'Approved' || entry.status === 'Rejected')?.timestamp;

    if (!requestedTime || !decisionTime) {
      return null;
    }

    const ms = new Date(decisionTime).getTime() - new Date(requestedTime).getTime();
    return Number.isFinite(ms) ? Math.max(0, ms) : null;
  }).filter(Boolean);

  const averageResponseMs = rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : 0;
  const avgHours = averageResponseMs / (1000 * 60 * 60);
  const responseScore = Math.max(0, Math.min(RELIABILITY_SCORE_CAP, RELIABILITY_SCORE_CAP - avgHours / 2));
  const approvedCount = hospitalRequests.filter((entry) => entry.status === 'Approved').length;
  const approvalRate = approvedCount / hospitalRequests.length;
  const reliability = (responseScore / RELIABILITY_SCORE_CAP) * 0.5 + approvalRate * 0.5;
  return Math.max(0.1, Math.min(1, reliability));
}

async function scoreHospital(hospital, resourceName, quantity, urgency = 'Low') {
  await data.initializeState();
  const { inventory, staff, hospitals, requests } = getState();
  const activeHospitalIds = hospitals.filter((entry) => entry.accountStatus === 'Active').map((entry) => entry.id);
  const hospitalInventoryItems = inventory.filter((item) => {
    const itemHospitalId = item.hospitalId || item.hospital_id;
    return activeHospitalIds.includes(itemHospitalId) && itemHospitalId === hospital.id;
  });
  const matchingInventoryItems = hospitalInventoryItems.filter((item) => {
    const itemName = item.resourceName || item.item || item.name || '';
    if (!resourceName) return true;
    return itemName.toLowerCase() === resourceName.toLowerCase();
  });
  const inventoryCount = matchingInventoryItems.reduce((sum, item) => {
    return sum + (item.publishedQuantity ?? item.availableQuantity ?? item.quantity ?? item.available ?? item.stock ?? 0);
  }, 0);
  const fallbackInventoryCount = hospitalInventoryItems.length
    ? (hospitalInventoryItems[0].publishedQuantity ?? hospitalInventoryItems[0].availableQuantity ?? hospitalInventoryItems[0].quantity ?? hospitalInventoryItems[0].available ?? hospitalInventoryItems[0].stock ?? 0)
    : 0;
  const stockQuantity = inventoryCount > 0 ? inventoryCount : fallbackInventoryCount;

  const staffAvailable = staff
    .filter((member) => member.hospitalId === hospital.id && (member.status === 'Available' || member.status === 'Deployable'))
    .reduce((sum, member) => sum + (member.publishedCount ?? member.availableCount ?? member.count ?? 0), 0);
  const normalizedResourceName = (resourceName || '').toLowerCase();
  const urgencyLevel = URGENCY_PRIORITY[urgency] ?? 0;

  const stockScore = stockQuantity <= 0
    ? 0
    : Math.min(STOCK_SCORE_CAP, Math.max(1, Math.round(stockQuantity / 50)));
  const staffScore = normalizedResourceName.includes('nurse')
    ? Math.min(STAFF_SCORE_CAP, Math.max(1, staffAvailable))
    : Math.min(STAFF_SCORE_CAP, Math.max(1, Math.round(staffAvailable / 2)));
  const emergencyScore = EMERGENCY_SCORE_LOOKUP[hospital.emergencyStatus] ?? EMERGENCY_SCORE_LOOKUP.Low;
  const distanceScore = normalizeDistance(hospital.distance);
  const reliabilityScore = getReliabilityScore(hospital.id, requests);
  const urgencyBoost = Math.max(0, urgencyLevel) * URGENCY_WEIGHT;

  const urgencyAdjustedStockWeight = STOCK_WEIGHT + urgencyBoost;
  const urgencyAdjustedEmergencyWeight = EMERGENCY_WEIGHT + urgencyBoost;
  const urgencyAdjustedDistanceWeight = DISTANCE_WEIGHT + urgencyBoost * 0.5;
  const urgencyAdjustedReliabilityWeight = RELIABILITY_WEIGHT + urgencyBoost * 0.5;
  const urgencyAdjustedStaffWeight = STAFF_WEIGHT + urgencyBoost * 0.25;

  const weightedTotal =
    (stockScore / MAX_SCORE) * urgencyAdjustedStockWeight +
    (staffScore / MAX_SCORE) * urgencyAdjustedStaffWeight +
    (emergencyScore / MAX_SCORE) * urgencyAdjustedEmergencyWeight +
    distanceScore * urgencyAdjustedDistanceWeight +
    reliabilityScore * urgencyAdjustedReliabilityWeight;

  const availabilityPenalty = stockQuantity <= 0 ? -0.5 : 0;
  const total = Math.max(0, weightedTotal + availabilityPenalty);
  const rounded = Number(Math.min(MAX_SCORE, total).toFixed(2));

  return {
    ...hospital,
    resourceName,
    quantity,
    urgency,
    score: rounded,
    stock: stockQuantity,
    availableStaff: staffAvailable,
    reasonBreakdown: {
      stock: Number((stockScore / MAX_SCORE).toFixed(2)),
      staff: Number((staffScore / MAX_SCORE).toFixed(2)),
      emergency: Number((emergencyScore / MAX_SCORE).toFixed(2)),
      distance: Number(distanceScore.toFixed(2)),
      reliability: Number(reliabilityScore.toFixed(2)),
    },
  };
}

async function recommendHospitals({ currentHospitalId, resourceName, quantity, urgency = 'Low' }) {
  await data.initializeState();
  const { hospitals } = getState();
  const scored = await Promise.all(
    hospitals
      .filter((hospital) => hospital.id !== currentHospitalId)
      .filter((hospital) => hospital.accountStatus === 'Active')
      .filter((hospital) => hospital.role === 'Hospital')
      .map(async (hospital) => scoreHospital(hospital, resourceName, quantity, urgency))
  );

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distance !== b.distance) {
        return Number(a.distance) - Number(b.distance);
      }
      return b.stock - a.stock;
    })
    .map((hospital, index) => ({ ...hospital, rank: index + 1 }));
}

module.exports = { recommendHospitals, scoreHospital };
