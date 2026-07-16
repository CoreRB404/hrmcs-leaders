const express = require('express');
const data = require('../data');
const { createResourceRequest, respondToRequest, reviewRequestClinicalStage, approveRequest, prioritizeRequests } = require('../utils/hospitalService');
const { recommendHospitals } = require('../utils/recommendation');
const { authMiddleware, requireAdmin, requireRole, denyAdmin } = require('../utils/auth');

const router = express.Router();

const getHospitalById = (hospitalId) => data.getHospitals().find((hospital) => hospital.id === hospitalId);
const VALID_URGENCIES = ['Low', 'Medium', 'High', 'Critical'];

// GET /api/requests — role-based filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    const allRequests = prioritizeRequests(data.getRequests());
    const userRole = req.auth.role;
    const userId = req.auth.id;

    if (userRole === 'Admin') {
      // Admin sees all requests
      res.json(allRequests);
    } else if (['Doctor', 'Pharmacist'].includes(userRole)) {
      const reviewerHospitalId = req.auth.hospitalId || userId;
      res.json(allRequests.filter((request) => request.providerHospitalId === reviewerHospitalId));
    } else {
      // Hospital users only see requests where they are requester OR provider
      const filtered = allRequests.filter((request) => {
        return request.requesterHospitalId === userId
          || request.providerHospitalId === userId
          || request.hospitalId === userId;
      });
      res.json(filtered);
    }
  } catch (error) {
    res.status(500).json({ error: 'Unable to load requests' });
  }
});

// POST /api/requests
router.post('/', authMiddleware, denyAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const { requesterHospitalId, providerHospitalId, resourceType, resourceName, quantity, urgency } = req.body;
    console.log('[POST /api/requests] body:', JSON.stringify(req.body));
    console.log('[POST /api/requests] parsed:', { requesterHospitalId, providerHospitalId, resourceName, quantity, type: typeof quantity });
    if (!requesterHospitalId || !providerHospitalId || !resourceName || !quantity || quantity <= 0) {
      console.log('[POST /api/requests] VALIDATION FAILED:', { requesterHospitalId: !!requesterHospitalId, providerHospitalId: !!providerHospitalId, resourceName: !!resourceName, quantity, quantityCheck: !quantity || quantity <= 0 });
      return res.status(400).json({ error: 'Request creation requires requester, provider, resource name, and positive quantity.' });
    }
    if (urgency && !VALID_URGENCIES.includes(urgency)) {
      return res.status(400).json({ error: 'Urgency must be Low, Medium, High, or Critical.' });
    }

    if (requesterHospitalId === providerHospitalId) {
      return res.status(400).json({ error: 'You cannot request resources from your own hospital.' });
    }

    const provider = getHospitalById(providerHospitalId);
    if (!provider || provider.accountStatus !== 'Active') {
      return res.status(400).json({ error: 'Provider hospital must be active to fulfill requests.' });
    }

    const request = createResourceRequest(req.body);
    const suggestions = await recommendHospitals({ currentHospitalId: requesterHospitalId, resourceName, quantity, urgency: urgency || 'Low' });
    res.json({ request, suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/requests/:id/respond
router.post('/:id/respond', authMiddleware, denyAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const { response, notes } = req.body;
    const request = respondToRequest({ requestId: req.params.id, responderHospitalId: req.auth.id, response, notes });
    res.json(request);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// POST /api/requests/:id/pharmacist-review
router.post('/:id/pharmacist-review', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    const reviewerHospitalId = req.auth.hospitalId || req.auth.id;
    if (req.auth.role !== 'Pharmacist') {
      return res.status(403).json({ error: 'Pharmacist access required' });
    }

    const request = reviewRequestClinicalStage({
      requestId: req.params.id,
      reviewerHospitalId,
      reviewerRole: 'Pharmacist',
      decision: req.body.decision,
      notes: req.body.notes,
    });
    res.json({ request });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/requests/:id/doctor-review
router.post('/:id/doctor-review', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    const reviewerHospitalId = req.auth.hospitalId || req.auth.id;
    if (req.auth.role !== 'Doctor') {
      return res.status(403).json({ error: 'Doctor access required' });
    }

    const request = reviewRequestClinicalStage({
      requestId: req.params.id,
      reviewerHospitalId,
      reviewerRole: 'Doctor',
      decision: req.body.decision,
      notes: req.body.notes,
    });
    res.json({ request });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/requests/:id/approve
router.post('/:id/approve', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const request = approveRequest({ requestId: req.params.id, approverHospitalId: req.auth.id });
    res.json({ request });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/requests/transfer
router.post('/transfer', authMiddleware, denyAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const { requesterHospitalId, providerHospitalId, resourceName, quantity, urgency } = req.body;
    if (!requesterHospitalId || !providerHospitalId || !resourceName || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Please select a provider, add a resource name, and enter a positive quantity.' });
    }

    if (requesterHospitalId === providerHospitalId) {
      return res.status(400).json({ error: 'Cannot request resources from your own hospital.' });
    }
    if (urgency && !VALID_URGENCIES.includes(urgency)) {
      return res.status(400).json({ error: 'Urgency must be Low, Medium, High, or Critical.' });
    }

    const provider = getHospitalById(providerHospitalId);
    if (!provider || provider.accountStatus !== 'Active') {
      return res.status(400).json({ error: 'Provider now must be active to receive transfer requests.' });
    }

    const request = createResourceRequest(req.body);
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
