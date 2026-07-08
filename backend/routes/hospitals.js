const express = require('express');
const data = require('../data');
const { registerHospital, deleteHospitalAccount, addResourceListing, addStaffEntry } = require('../utils/hospitalService');
const { authMiddleware, requireAdmin, denyAdmin } = require('../utils/auth');

const router = express.Router();

const getActiveHospitals = () => data.getHospitals().filter((hospital) => hospital.accountStatus === 'Active');
const getHospitalById = (hospitalId) => data.getHospitals().find((hospital) => hospital.id === hospitalId);

// GET /api/hospitals
router.get('/', async (req, res) => {
  try {
    await data.initializeState();
    const search = (req.query.search || '').toLowerCase();
    const hospitals = data.getHospitals().filter((hospital) => {
      if (!search) return true;
      return [hospital.name, hospital.location, hospital.type, hospital.visibility].some((value) => value.toLowerCase().includes(search));
    });
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load hospitals' });
  }
});

// GET /api/hospitals/pending
router.get('/pending', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await data.initializeState();
    res.json(data.getHospitals().filter((hospital) => hospital.accountStatus === 'Pending'));
  } catch (error) {
    res.status(500).json({ error: 'Unable to load pending hospitals' });
  }
});

// POST /api/hospitals/register
router.post('/register', async (req, res) => {
  try {
    await data.initializeState();
    const hospital = registerHospital(req.body);
    res.status(201).json(hospital);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/hospitals/listing
router.post('/listing', authMiddleware, denyAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const { hospitalId, resourceType, resourceName, quantity } = req.body;
    if (!hospitalId || !resourceName || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Hospital listings require a valid hospital, resource name, and positive quantity.' });
    }

    const hospital = data.getHospitals().find((entry) => entry.id === hospitalId);
    if (!hospital || hospital.accountStatus !== 'Active') {
      return res.status(400).json({ error: 'Only active hospitals may publish listings.' });
    }

    const listing = addResourceListing(req.body);
    res.status(201).json(listing);
  } catch (error) {
    res.status(500).json({ error: 'Unable to create listing' });
  }
});

// POST /api/hospitals/staff
router.post('/staff', authMiddleware, denyAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const { role, status, count } = req.body;
    const entry = addStaffEntry({ hospitalId: req.auth.id, role, status, count });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Unable to update staff' });
  }
});

// POST /api/hospitals/:hospitalId/approve
router.post('/:hospitalId/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const hospitals = data.getHospitals();
    const notifications = data.getNotifications();
    const hospital = hospitals.find((entry) => entry.id === req.params.hospitalId);

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    hospital.accountStatus = 'Active';
    hospital.approvedAt = new Date().toISOString();

    const state = data.getState();
    state.hospitals = hospitals;
    state.notifications = [{ id: `notif-${Date.now()}`, message: `${hospital.name} has been approved and activated`, severity: 'Medium' }, ...notifications];
    data.setState(state);

    // Persist status change to SQLite
    data.persistHospitalStatus(hospital.id, 'Active');

    res.json(hospital);
  } catch (error) {
    res.status(500).json({ error: 'Unable to approve hospital' });
  }
});

// DELETE /api/hospitals/:hospitalId
router.delete('/:hospitalId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const result = deleteHospitalAccount(req.params.hospitalId);
    res.json({ success: true, deletedHospital: result.deletedHospital });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

module.exports = router;
