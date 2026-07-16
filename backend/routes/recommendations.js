const express = require('express');
const { recommendHospitals } = require('../utils/recommendation');
const { authMiddleware } = require('../utils/auth');

const router = express.Router();

// GET /api/recommendations/:resourceName?
router.get('/:resourceName?', authMiddleware, async (req, res) => {
  try {
    const resourceName = decodeURIComponent(req.params.resourceName || '').trim();
    const currentHospitalId = req.query.currentHospitalId || req.auth?.id || null;
    const quantity = Number(req.query.quantity || 10);
    const urgency = req.query.urgency || 'High';
    const suggestions = await recommendHospitals({ currentHospitalId, resourceName, quantity, urgency });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
