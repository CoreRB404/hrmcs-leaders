const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'hrmcs-dev-secret';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(inputPassword, storedHash) {
  return hashPassword(inputPassword) === storedHash || inputPassword === storedHash;
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function verifyToken(token) {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const data = require('../data');
    await data.initializeState();
    const account = data.getHospitals().find((entry) => entry.id === payload.id);
    const accountHospitalId = account?.hospitalId || account?.id;
    const tokenHospitalId = payload.hospitalId || payload.id;
    if (!account
      || account.accountStatus !== 'Active'
      || (account.role || 'Hospital') !== payload.role
      || accountHospitalId !== tokenHospitalId) {
      return res.status(401).json({ error: 'Session is no longer active' });
    }

    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Unable to validate session' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.auth || req.auth.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.auth || req.auth.role !== requiredRole) {
      return res.status(403).json({ error: `${requiredRole} access required` });
    }

    next();
  };
}

function denyAdmin(req, res, next) {
  if (req.auth && req.auth.role === 'Admin') {
    return res.status(403).json({ error: 'Admin cannot perform hospital operations' });
  }

  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  authMiddleware,
  requireAdmin,
  requireRole,
  denyAdmin,
};
