const express = require('express');
const { recommendHospitals } = require('../utils/recommendation');

const router = express.Router();

// GET /api/recommendations/:resourceName
router.get('/:resourceName', (req, res) => {
  const resourceName = req.params.resourceName;
  const suggestions = recommendHospitals({ currentHospitalId: 'hospital-a', resourceName, quantity: 10 });
  res.json(suggestions);
});

module.exports = router;
