const express = require('express');
const rethinkdb = require('rethinkdb');
const cors = require('cors');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const DB_HOST = process.env.DB_HOST || 'rethinkdb'; // Use Docker service name
const DB_PORT = process.env.DB_PORT || 28015;
const DB_NAME = 'sensors';
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

let connection;

// Connection handling with retries
async function connectWithRetries(retries = MAX_RETRIES) {
  try {
    const conn = await rethinkdb.connect({ 
      host: DB_HOST,
      port: DB_PORT,
      timeout: 10
    });
    
    // Handle connection errors
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      connection = null;
    });

    console.log('✅ Successfully connected to RethinkDB');
    return conn;
  } catch (err) {
    if (retries <= 0) {
      console.error('❌ Max connection retries reached');
      throw err;
    }
    console.log(`Retrying connection... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    return connectWithRetries(retries - 1);
  }
}

// ==================== API ENDPOINTS ====================

// Debug endpoint to verify database connection
app.get('/api/debug/status', async (req, res) => {
  try {
    if (!connection) throw new Error('No database connection');
    
    const dbList = await r.dbList().run(connection);
    const tables = await r.db(DB_NAME).tableList().run(connection);
    const counts = {};
    
    for (const table of tables) {
      counts[table] = await r.db(DB_NAME).table(table).count().run(connection);
    }

    res.json({
      status: 'healthy',
      database: DB_NAME,
      tables: counts,
      connection: {
        host: DB_HOST,
        port: DB_PORT,
        connected: !!connection
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      connection: {
        host: DB_HOST,
        port: DB_PORT,
        connected: false
      }
    });
  }
});

// Power BI API Endpoints
app.get('/api/powerbi/buildings', async (req, res) => {
  if (!connection) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { governorate, type } = req.query;
    let query = r.db(DB_NAME).table('buildings');

    if (governorate) query = query.getAll(governorate, { index: 'governorate' });
    if (type) query = query.getAll(type, { index: 'type' });

    const results = await query.run(connection);
    const buildings = await results.toArray();

    if (buildings.length === 0) {
      console.warn('No buildings found - is the database populated?');
    }

    res.json(buildings);
  } catch (err) {
    console.error('Buildings endpoint error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to query buildings'
    });
  }
});

app.get('/api/powerbi/contacts', async (req, res) => {
  if (!connection) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { building_id, role } = req.query;
    let query = r.db(DB_NAME).table('contacts');

    if (building_id) query = query.getAll(building_id, { index: 'building_id' });
    if (role) query = query.getAll(role, { index: 'role' });

    const results = await query.run(connection);
    res.json(await results.toArray());
  } catch (err) {
    console.error('Contacts endpoint error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to query contacts'
    });
  }
});

app.get('/api/powerbi/sensors', async (req, res) => {
  if (!connection) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { building_id, type } = req.query;
    let query = r.db(DB_NAME).table('sensors');

    if (building_id) query = query.getAll(building_id, { index: 'building_id' });
    if (type) query = query.getAll(type, { index: 'type' });

    const results = await query.run(connection);
    res.json(await results.toArray());
  } catch (err) {
    console.error('Sensors endpoint error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to query sensors'
    });
  }
});

app.get('/api/powerbi/readings', async (req, res) => {
  if (!connection) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { sensor_id, building_id, start_date, end_date, limit = 1000 } = req.query;
    let query = r.db(DB_NAME).table('readings');

    if (sensor_id) query = query.getAll(sensor_id, { index: 'sensor_id' });
    if (building_id) query = query.getAll(building_id, { index: 'building_id' });
    if (start_date) query = query.filter(r.row('timestamp').ge(new Date(start_date)));
    if (end_date) query = query.filter(r.row('timestamp').le(new Date(end_date)));

    query = query.orderBy({ index: r.desc('timestamp') }).limit(parseInt(limit));

    const results = await query.run(connection);
    res.json(await results.toArray());
  } catch (err) {
    console.error('Readings endpoint error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to query readings'
    });
  }
});

app.get('/api/powerbi/aggregated', async (req, res) => {
  if (!connection) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { period = 'month', sensor_type } = req.query;
    let query = r.db(DB_NAME)
      .table('readings')
      .group([r.row('sensor_id'), r.row('timestamp').date().floor(period)])
      .avg('value');

    if (sensor_type) {
      query = query.filter(r.row('sensor_type').eq(sensor_type));
    }

    const results = await query.run(connection);
    res.json(await results.toArray());
  } catch (err) {
    console.error('Aggregated endpoint error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to query aggregated data'
    });
  }
});

// Initialize and start server
async function startServer() {
  try {
    connection = await connectWithRetries();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('Available Endpoints:');
      console.log(`- http://localhost:${PORT}/api/debug/status`);
      console.log(`- http://localhost:${PORT}/api/powerbi/buildings`);
      console.log(`- http://localhost:${PORT}/api/powerbi/contacts`);
      console.log(`- http://localhost:${PORT}/api/powerbi/sensors`);
      console.log(`- http://localhost:${PORT}/api/powerbi/readings`);
      console.log(`- http://localhost:${PORT}/api/powerbi/aggregated`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  if (connection) {
    await connection.close();
  }
  process.exit(0);
});

startServer();