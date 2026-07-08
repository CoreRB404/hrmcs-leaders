const express = require('express');
const { createPatientSupportRequest } = require('../utils/hospitalService');
const { authMiddleware, denyAdmin } = require('../utils/auth');

const router = express.Router();

router.post('/', authMiddleware, denyAdmin, (req, res) => {
  const supportRequest = createPatientSupportRequest(req.body);
  res.status(201).json(supportRequest);
});

module.exports = router;
