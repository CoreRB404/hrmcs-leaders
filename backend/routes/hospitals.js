const express = require('express');
const data = require('../data');
const { registerHospital, deleteHospitalAccount, addResourceListing, addStaffEntry, updateHospitalEmergencyStatus, updateHospitalDistance } = require('../utils/hospitalService');
const { authMiddleware, requireAdmin, denyAdmin, hashPassword } = require('../utils/auth');

const router = express.Router();

const getActiveHospitals = () => data.getHospitals().filter((hospital) => hospital.accountStatus === 'Active');
const getHospitalById = (hospitalId) => data.getHospitals().find((hospital) => hospital.id === hospitalId);
const isReviewer = (account) => account && ['Doctor', 'Pharmacist'].includes(account.role);
const publicReviewer = (account) => ({
  id: account.id,
  hospitalId: account.hospitalId,
  name: account.name,
  email: account.email,
  role: account.role,
  accountStatus: account.accountStatus,
  location: account.location,
});
const publicHospital = ({ password, ...hospital }) => hospital;

// GET /api/hospitals
router.get('/', async (req, res) => {
  try {
    await data.initializeState();
    const search = (req.query.search || '').toLowerCase();
    const hospitals = data.getHospitals().filter((hospital) => hospital.role === 'Hospital').filter((hospital) => {
      if (!search) return true;
      return [hospital.name, hospital.location, hospital.type, hospital.visibility].some((value) => value.toLowerCase().includes(search));
    });
    res.json(hospitals.map(publicHospital));
  } catch (error) {
    res.status(500).json({ error: 'Unable to load hospitals' });
  }
});

// GET /api/hospitals/pending
router.get('/pending', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await data.initializeState();
    res.json(data.getHospitals().filter((hospital) => hospital.role === 'Hospital' && hospital.accountStatus === 'Pending').map(publicHospital));
  } catch (error) {
    res.status(500).json({ error: 'Unable to load pending hospitals' });
  }
});

// GET /api/hospitals/reviewers
router.get('/reviewers', authMiddleware, async (req, res) => {
  await data.initializeState();
  if (!['Hospital', 'Admin'].includes(req.auth.role)) {
    return res.status(403).json({ error: 'Hospital or admin access required' });
  }

  const hospitalId = req.auth.hospitalId || req.auth.id;
  const reviewers = data.getHospitals()
    .filter((account) => isReviewer(account) && (req.auth.role === 'Admin' || account.hospitalId === hospitalId))
    .map((account) => ({
      ...publicReviewer(account),
      hospitalName: data.getHospitals().find((hospital) => hospital.id === account.hospitalId)?.name || account.hospitalId,
    }));
  return res.json(reviewers);
});

// PATCH /api/hospitals/reviewers/:reviewerId
router.patch('/reviewers/:reviewerId', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    if (!['Hospital', 'Admin'].includes(req.auth.role)) {
      return res.status(403).json({ error: 'Hospital or admin access required' });
    }

    const reviewer = data.getHospitals().find((account) => account.id === req.params.reviewerId);
    if (!isReviewer(reviewer)) {
      return res.status(404).json({ error: 'Reviewer account not found' });
    }

    const hospitalId = req.auth.hospitalId || req.auth.id;
    if (req.auth.role === 'Hospital' && reviewer.hospitalId !== hospitalId) {
      return res.status(403).json({ error: 'You cannot manage another hospital reviewer' });
    }

    const { email, newPassword, accountStatus } = req.body;
    if (email != null && req.auth.role !== 'Hospital') {
      return res.status(403).json({ error: 'Only the assigned hospital can change reviewer email addresses' });
    }
    if (email != null) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: 'A valid reviewer email is required' });
      }
      const duplicate = data.getHospitals().some((account) => account.id !== reviewer.id && account.email.toLowerCase() === normalizedEmail);
      if (duplicate) return res.status(409).json({ error: 'Email is already in use' });
      reviewer.email = normalizedEmail;
    }
    if (newPassword != null) {
      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      reviewer.password = hashPassword(String(newPassword));
    }
    if (accountStatus != null) {
      if (!['Active', 'Suspended'].includes(accountStatus)) {
        return res.status(400).json({ error: 'Reviewer status must be Active or Suspended' });
      }
      const parentHospital = getHospitalById(reviewer.hospitalId);
      if (accountStatus === 'Active' && parentHospital?.accountStatus !== 'Active') {
        return res.status(400).json({ error: 'Reviewer cannot be activated until the hospital is active' });
      }
      reviewer.accountStatus = accountStatus;
    }

    await data.persistHospitalAccount(reviewer);
    return res.json({ reviewer: publicReviewer(reviewer) });
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email is already in use' });
    }
    return res.status(500).json({ error: 'Unable to update reviewer account' });
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
    const reviewerAccounts = hospitals.filter((entry) => entry.hospitalId === hospital.id && ['Doctor', 'Pharmacist'].includes(entry.role));
    reviewerAccounts.forEach((reviewer) => {
      reviewer.accountStatus = 'Active';
      reviewer.approvedAt = hospital.approvedAt;
    });

    const state = data.getState();
    state.hospitals = hospitals;
    state.notifications = [{ id: `notif-${Date.now()}`, message: `${hospital.name} has been approved and activated`, severity: 'Medium' }, ...notifications];
    data.setState(state);

    // Persist status change to SQLite
    await Promise.all([
      data.persistHospitalStatus(hospital.id, 'Active'),
      ...reviewerAccounts.map((reviewer) => data.persistHospitalStatus(reviewer.id, 'Active')),
    ]);

    res.json(publicHospital(hospital));
  } catch (error) {
    res.status(500).json({ error: 'Unable to approve hospital' });
  }
});

// PATCH /api/hospitals/:hospitalId/emergency-status
// Admins may manage every hospital; a Hospital account may manage only itself.
router.patch('/:hospitalId/emergency-status', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    const { emergencyStatus } = req.body;
    const hospital = getHospitalById(req.params.hospitalId);

    const isAdmin = req.auth?.role === 'Admin';
    const isOwningHospital = req.auth?.role === 'Hospital' && req.auth?.id === req.params.hospitalId;
    if (!isAdmin && !isOwningHospital) {
      return res.status(403).json({ error: 'You may only update emergency readiness for your own hospital.' });
    }

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (!['Low', 'Medium', 'High'].includes(emergencyStatus)) {
      return res.status(400).json({ error: 'Invalid emergency status' });
    }

    const updatedHospital = await updateHospitalEmergencyStatus(req.params.hospitalId, emergencyStatus);
    res.json(publicHospital(updatedHospital));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to update emergency status' });
  }
});

// PATCH /api/hospitals/:hospitalId/distance
// Admins may manage every hospital; a Hospital account may manage only itself.
router.patch('/:hospitalId/distance', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    const isAdmin = req.auth?.role === 'Admin';
    const isOwningHospital = req.auth?.role === 'Hospital' && req.auth?.id === req.params.hospitalId;
    if (!isAdmin && !isOwningHospital) {
      return res.status(403).json({ error: 'You may only update distance for your own hospital.' });
    }

    const distance = Number(req.body.distance);
    if (!Number.isFinite(distance) || distance < 0) {
      return res.status(400).json({ error: 'Distance must be a non-negative number.' });
    }

    const updatedHospital = await updateHospitalDistance(req.params.hospitalId, distance);
    res.json(publicHospital(updatedHospital));
  } catch (error) {
    const status = error.message === 'Hospital not found' ? 404 : 500;
    res.status(status).json({ error: error.message || 'Unable to update distance' });
  }
});

// DELETE /api/hospitals/:hospitalId
router.delete('/:hospitalId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    await data.initializeState();
    const result = deleteHospitalAccount(req.params.hospitalId);
    await data.persistHospitalDeletion(req.params.hospitalId);
    res.json({ success: true, deletedHospital: publicHospital(result.deletedHospital) });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

module.exports = router;
