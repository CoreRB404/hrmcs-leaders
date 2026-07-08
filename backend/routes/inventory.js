const express = require('express');
const data = require('../data');
const { addResourceListing } = require('../utils/hospitalService');
const { authMiddleware, denyAdmin } = require('../utils/auth');

const router = express.Router();

const getActiveHospitals = () => data.getHospitals().filter((hospital) => hospital.accountStatus === 'Active');
const getHospitalById = (hospitalId) => data.getHospitals().find((hospital) => hospital.id === hospitalId);

// GET /api/inventory
router.get('/', (req, res) => {
  const activeIds = getActiveHospitals().map((hospital) => hospital.id);
  res.json(data.getInventory().filter((item) => activeIds.includes(item.hospitalId)));
});

// POST /api/inventory/listing
router.post('/listing', authMiddleware, denyAdmin, (req, res) => {
  const { hospitalId, resourceType, resourceName, quantity } = req.body;
  if (!hospitalId || !resourceName || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Hospital listings require a valid hospital, resource name, and positive quantity.' });
  }

  const hospital = getHospitalById(hospitalId);
  if (!hospital || hospital.accountStatus !== 'Active') {
    return res.status(400).json({ error: 'Only active hospitals may publish listings.' });
  }

  const listing = addResourceListing(req.body);
  res.status(201).json(listing);
});

module.exports = router;
