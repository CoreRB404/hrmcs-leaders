const express = require('express');
const data = require('../data');
const { addStaffEntry } = require('../utils/hospitalService');
const { authMiddleware, denyAdmin } = require('../utils/auth');

const router = express.Router();

const getActiveHospitals = () => data.getHospitals().filter((hospital) => hospital.accountStatus === 'Active');

// GET /api/staff
router.get('/', (req, res) => {
  const activeIds = getActiveHospitals().map((hospital) => hospital.id);
  res.json(data.getStaff().filter((item) => activeIds.includes(item.hospitalId)));
});

// POST /api/staff
router.post('/', authMiddleware, denyAdmin, (req, res) => {
  const { role, status, count } = req.body;
  const entry = addStaffEntry({ hospitalId: req.auth.id, role, status, count });
  res.status(201).json(entry);
});

module.exports = router;
