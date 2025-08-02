// server/app.js
const express = require('express');
const r = require('rethinkdb');
const routes = require('./routes');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { getConnection } = require('./db');
const API_URL = "http://localhost:3001/api";


const app = express();

// ======================
// Middleware Setup
// ======================
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    const conn = await r.connect({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 28015,
      db: process.env.DB_NAME || 'sensors'
    });
    req.dbConn = conn;
    next();
  } catch (err) {
    next(err);
  }
});

// ======================
// Health Endpoints
// ======================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      data_generation: app.get('dataGenerator') ? 'active' : 'inactive'
    }
  });
});

// ======================
// Data Generator Control
// ======================
app.post('/api/admin/data/start', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden in production' });
  }

  try {
    const regenerate = req.query.regenerate === 'true';
    await app.get('dataGenerator').initialize(regenerate);
    res.json({ 
      status: 'started',
      regenerate,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/data/stop', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden in production' });
  }

  try {
    await app.get('dataGenerator').stopContinuousGeneration();
    res.json({ 
      status: 'stopped',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/data/status', async (req, res) => {
  const generator = app.get('dataGenerator');
  res.json({
    active: generator && generator.generationInterval !== null,
    sensors_count: generator ? generator.sensors.length : 0,
    last_run: new Date().toISOString()
  });
});

// ======================
// Application Routes
// ======================
app.use('/api', routes);  // Now all routes are under /api (e.g., /api/sensors)
//app.use('/api/buildings', require('./routes/buildings'));
//app.use('/api/sensors', require('./routes/sensors'));
//app.use('/api/readings', require('./routes/readings'));
//app.use('/api/contacts', require('./routes/contacts'));

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

//app.use((err, req, res, next) => {
//  console.error(err.stack);
//  res.status(500).json({ 
//    error: 'Internal server error',
//    timestamp: new Date().toISOString()
//  });
//});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;