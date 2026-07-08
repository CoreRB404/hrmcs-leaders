const express = require('express');
const { getHospitalByEmail } = require('../sqlite');
const data = require('../data');
const { verifyPassword, signToken } = require('../utils/auth');

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

    const token = signToken({ id: hospital.id, email: hospital.email, role: hospital.role || 'Hospital' });
    // Return full hospital object so frontend has location, type, etc.
    res.json({
      token,
      hospital: {
        id: hospital.id,
        name: hospital.name,
        role: hospital.role || 'Hospital',
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

module.exports = router;
