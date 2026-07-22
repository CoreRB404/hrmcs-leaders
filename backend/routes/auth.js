const express = require('express');
const { getHospitalByEmail } = require('../sqlite');
const data = require('../data');
const { verifyPassword, hashPassword, signToken, authMiddleware } = require('../utils/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check SQLite first (for seeded/persisted accounts)
    let hospital = await getHospitalByEmail(email);

    // Also check in-memory state (for newly registered hospitals not yet in SQLite or just persisted)
    if (!hospital) {
      await data.initializeState();
      hospital = data.getHospitalByEmailFromMemory(email);
    }

    if (!hospital || !verifyPassword(password, hospital.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (hospital.accountStatus !== 'Active') {
      return res.status(403).json({ error: hospital.accountStatus === 'Pending' ? 'Hospital account pending admin approval' : 'Hospital account not active' });
    }

    const token = signToken({
      id: hospital.id,
      email: hospital.email,
      role: hospital.role || 'Hospital',
      hospitalId: hospital.hospitalId || hospital.id,
    });
    // Return full hospital object so frontend has location, type, etc.
    res.json({
      token,
      hospital: {
        id: hospital.id,
        name: hospital.name,
        role: hospital.role || 'Hospital',
        hospitalId: hospital.hospitalId || hospital.id,
        location: hospital.location,
        type: hospital.type,
        accountStatus: hospital.accountStatus,
      },
    });
  } catch (error) {
    console.error('Login failed', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
});

// POST /api/auth/reviewer-login
// This is intentionally separate from public login. A hospital must already be
// authenticated, and only a reviewer assigned to that hospital may enter.
router.post('/reviewer-login', authMiddleware, async (req, res) => {
  if (req.auth.role !== 'Hospital') {
    return res.status(403).json({ error: 'Reviewer access can only be opened from a hospital workspace' });
  }

  const { email, password } = req.body;
  const workspaceHospitalId = req.auth.hospitalId || req.auth.id;

  try {
    let reviewer = await getHospitalByEmail(email);
    if (!reviewer) {
      await data.initializeState();
      reviewer = data.getHospitalByEmailFromMemory(email);
    }

    if (!reviewer || !verifyPassword(password, reviewer.password)) {
      return res.status(401).json({ error: 'Invalid reviewer credentials' });
    }

    if (!['Doctor', 'Pharmacist'].includes(reviewer.role)) {
      return res.status(403).json({ error: 'Only doctor and pharmacist accounts can enter reviewer access' });
    }

    if (reviewer.accountStatus !== 'Active') {
      return res.status(403).json({ error: 'Reviewer account is not active' });
    }

    if (reviewer.hospitalId !== workspaceHospitalId) {
      return res.status(403).json({ error: 'This reviewer is not assigned to this hospital' });
    }

    const token = signToken({
      id: reviewer.id,
      email: reviewer.email,
      role: reviewer.role,
      hospitalId: workspaceHospitalId,
    });

    return res.json({
      token,
      hospital: {
        id: reviewer.id,
        name: reviewer.name,
        role: reviewer.role,
        hospitalId: workspaceHospitalId,
        location: reviewer.location,
        type: reviewer.type,
        accountStatus: reviewer.accountStatus,
      },
    });
  } catch (error) {
    console.error('Reviewer login failed', error);
    return res.status(500).json({ error: 'Authentication service error' });
  }
});

// PATCH /api/auth/password
router.patch('/password', authMiddleware, async (req, res) => {
  try {
    await data.initializeState();
    if (!['Hospital', 'Doctor', 'Pharmacist'].includes(req.auth.role)) {
      return res.status(403).json({ error: 'Hospital or reviewer account required' });
    }

    const account = data.getHospitals().find((entry) => entry.id === req.auth.id);
    if (!account || !verifyPassword(req.body.currentPassword || '', account.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    if (String(req.body.newPassword || '').length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    account.password = hashPassword(String(req.body.newPassword));
    await data.persistHospitalAccount(account);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to change password' });
  }
});

module.exports = router;
