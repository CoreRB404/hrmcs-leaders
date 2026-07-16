const express = require('express');
const data = require('../data');
const { getAdminSummary } = require('../utils/hospitalService');
const { authMiddleware, requireAdmin } = require('../utils/auth');

const router = express.Router();

async function getDashboard(req, res) {
  try {
    await data.initializeState();
    const hospitals = data.getHospitals().filter((hospital) => hospital.role === 'Hospital');
    const inventory = data.getInventory();
    const staff = data.getStaff();
    const requests = data.getRequests();
    const criticalShortages = inventory.filter((item) => item.quantity <= item.minimumThreshold);
    const availableStaff = staff.filter((member) => member.status === 'Available' || member.status === 'Deployable');

    res.json({
      totalHospitals: hospitals.length,
      totalInventoryItems: inventory.length,
      criticalShortages,
      availableStaffCount: availableStaff.length,
      pendingRequests: requests.filter((request) => request.status === 'Pending').length,
      approvedRequests: requests.filter((request) => request.status === 'Approved').length,
      emergencyAlerts: hospitals.filter((hospital) => hospital.emergencyStatus === 'High').length,
    });
  } catch (error) {
    console.error('Dashboard error', error);
    res.status(500).json({ error: 'Unable to load dashboard' });
  }
}

async function getHospitalDashboard(req, res) {
  try {
    await data.initializeState();
    const workspaceHospitalId = req.auth.hospitalId || req.auth.id;
    if (req.auth.role !== 'Admin' && workspaceHospitalId !== req.params.hospitalId) {
      return res.status(403).json({ error: 'You cannot access another hospital workspace' });
    }

    const hospital = data.getHospitals().find((entry) => entry.id === req.params.hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    const hospitalInventory = data.getInventory().filter((item) => item.hospitalId === hospital.id);
    const hospitalRequests = data.getRequests().filter((request) => request.requesterHospitalId === hospital.id || request.providerHospitalId === hospital.id || request.hospitalId === hospital.id);
    const hospitalStaff = data.getStaff().filter((staff) => staff.hospitalId === hospital.id);
    const { password, ...publicHospital } = hospital;
    res.json({ hospital: publicHospital, hospitalInventory, hospitalRequests, hospitalStaff });
  } catch (error) {
    console.error('Hospital dashboard error', error);
    res.status(500).json({ error: 'Unable to load hospital dashboard' });
  }
}

async function getNotifications(req, res) {
  try {
    await data.initializeState();
    res.json(data.getNotifications());
  } catch (error) {
    console.error('Notifications error', error);
    res.status(500).json({ error: 'Unable to load notifications' });
  }
}

function adminSummaryHandler(req, res) {
  res.json(getAdminSummary());
}

router.get('/', authMiddleware, getDashboard);
router.get('/hospital/:hospitalId', authMiddleware, getHospitalDashboard);
router.get('/admin-summary', authMiddleware, requireAdmin, adminSummaryHandler);
router.get('/notifications', authMiddleware, getNotifications);

module.exports = {
  router,
  getDashboard,
  getHospitalDashboard,
  getNotifications,
  adminSummaryHandler,
};
