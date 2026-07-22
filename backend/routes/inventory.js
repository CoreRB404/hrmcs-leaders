const express = require('express');
const data = require('../data');
const { addResourceListing, updateResourceListing, setResourceListingStatus, deleteResourceListing } = require('../utils/hospitalService');
const { authMiddleware, requireRole } = require('../utils/auth');

const router = express.Router();

const getActiveHospitals = () => data.getHospitals().filter((hospital) => hospital.accountStatus === 'Active');
const getHospitalById = (hospitalId) => data.getHospitals().find((hospital) => hospital.id === hospitalId);

// GET /api/inventory
router.get('/', authMiddleware, async (req, res) => {
  await data.initializeState();
  const activeIds = getActiveHospitals().map((hospital) => hospital.id);
  res.json(data.getInventory().filter((item) => activeIds.includes(item.hospitalId) && item.status !== 'Inactive'));
});

// POST /api/inventory/listing
router.post('/listing', authMiddleware, requireRole('Hospital'), async (req, res) => {
  await data.initializeState();
  const hospitalId = req.auth.id;
  const { resourceName, quantity } = req.body;
  if (!resourceName || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
    return res.status(400).json({ error: 'Hospital listings require a valid hospital, resource name, and positive quantity.' });
  }

  const hospital = getHospitalById(hospitalId);
  if (!hospital || hospital.accountStatus !== 'Active') {
    return res.status(400).json({ error: 'Only active hospitals may publish listings.' });
  }

  try {
    const listing = addResourceListing({ ...req.body, hospitalId });
    res.status(201).json(listing);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id', authMiddleware, requireRole('Hospital'), async (req, res) => {
  try {
    await data.initializeState();
    const listing = updateResourceListing({ ...req.body, listingId: req.params.id, hospitalId: req.auth.id });
    res.json(listing);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/status', authMiddleware, requireRole('Hospital'), async (req, res) => {
  try {
    await data.initializeState();
    res.json(setResourceListingStatus({ listingId: req.params.id, hospitalId: req.auth.id, status: req.body.status }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, requireRole('Hospital'), async (req, res) => {
  try {
    await data.initializeState();
    const listing = deleteResourceListing({ listingId: req.params.id, hospitalId: req.auth.id });
    res.json({ success: true, listing });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
