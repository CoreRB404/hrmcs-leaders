const data = require('../data');

function getState() {
  return {
    hospitals: data.getHospitals(),
    inventory: data.getInventory(),
    staff: data.getStaff(),
  };
}

function scoreHospital(hospital, resourceName, quantity) {
  const { inventory, staff } = getState();
  const inventoryItem = inventory.find((item) => item.hospitalId === hospital.id && (item.item === resourceName || item.resourceName === resourceName));
  const staffAvailable = staff.filter((member) => member.hospitalId === hospital.id && (member.status === 'Available' || member.status === 'Deployable')).length;

  const stockScore = inventoryItem ? Math.min(5, Math.max(1, Math.round(inventoryItem.quantity / 50))) : 1;
  const distanceScore = hospital.distance <= 3 ? 5 : hospital.distance <= 8 ? 4 : hospital.distance <= 15 ? 3 : 2;
  const staffScore = resourceName.toLowerCase().includes('nurse') ? Math.min(5, Math.max(1, staffAvailable)) : 3;
  const emergencyScore = hospital.emergencyStatus === 'High' ? 5 : hospital.emergencyStatus === 'Medium' ? 3 : 2;

  const total = stockScore * 0.4 + distanceScore * 0.3 + staffScore * 0.2 + emergencyScore * 0.1;
  return {
    ...hospital,
    resourceName,
    quantity,
    score: Number(total.toFixed(2)),
    stock: inventoryItem ? inventoryItem.quantity : 0,
    availableStaff: staffAvailable,
  };
}

function recommendHospitals({ currentHospitalId, resourceName, quantity }) {
  const { hospitals } = getState();
  return hospitals
    .filter((hospital) => hospital.id !== currentHospitalId)
    .map((hospital) => scoreHospital(hospital, resourceName, quantity))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

module.exports = { recommendHospitals, scoreHospital };
