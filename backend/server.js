const express = require('express');
const cors = require('cors');
const { authMiddleware, requireAdmin } = require('./utils/auth');
const { initializeState } = require('./data');

// Import route modules
const authRoutes = require('./routes/auth');
const hospitalsRoutes = require('./routes/hospitals');
const inventoryRoutes = require('./routes/inventory');
const requestsRoutes = require('./routes/requests');
const staffRoutes = require('./routes/staff');
const dashboardRoutes = require('./routes/dashboard');
const patientSupportRoutes = require('./routes/patientSupport');
const recommendationsRoutes = require('./routes/recommendations');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HRMCS backend is running' });
});

// Mount route modules
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/dashboard', dashboardRoutes.router);
app.use('/api/patient-support', patientSupportRoutes);
app.use('/api/recommendations', recommendationsRoutes);

// Legacy compatibility endpoints
app.get('/api/admin-summary', authMiddleware, requireAdmin, dashboardRoutes.adminSummaryHandler);
app.get('/api/notifications', authMiddleware, dashboardRoutes.getNotifications);
app.get('/api/hospital-dashboard/:hospitalId', authMiddleware, dashboardRoutes.getHospitalDashboard);

initializeState()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`HRMCS backend listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize backend data layer', error);
    process.exit(1);
  });

module.exports = app;

