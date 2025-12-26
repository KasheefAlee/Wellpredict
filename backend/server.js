const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const checkinRoutes = require('./routes/checkins');
const dashboardRoutes = require('./routes/dashboard');
const attendanceRoutes = require('./routes/attendance');
const exportRoutes = require('./routes/export');
const publicCheckinRoutes = require('./routes/publicCheckin');
const adminRoutes = require('./routes/admin');
const hrRoutes = require('./routes/hr');
const managerRoutes = require('./routes/manager');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Fail fast on critical config in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is required in production');
  process.exit(1);
}

// Middleware
app.use(requestLogger);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '1mb' })); // avoid huge payloads
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
// Manager-specific route prefix (alias to attendance module for /api/manager/attendance/upload)
app.use('/api/manager/attendance', attendanceRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/public/checkin', publicCheckinRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Employee Wellbeing API is running' });
});

// Root route (helps avoid "Cannot GET /" on deployments)
app.get('/', (req, res) => {
  res.json({
    name: 'Wellpredict API',
    status: 'ok',
    health: '/health',
    apiHealth: '/api/health',
  });
});

// Production-style health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Centralized error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

