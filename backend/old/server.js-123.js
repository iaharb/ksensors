const express = require('express');
const r = require('rethinkdb');
const cors = require('cors');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const DB_HOST = process.env.DB_HOST || 'rethinkdb';
const DB_PORT = process.env.DB_PORT || 28015;
const DB_NAME = 'sensors';

// Middleware
app.use(cors());
app.use(express.json());

// Enhanced logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

let conn = null; // Database connection

// Database initialization
async function initDatabase() {
  try {
    // Create database if not exists
    const dbList = await r.dbList().run(conn);
    if (!dbList.includes(DB_NAME)) {
      await r.dbCreate(DB_NAME).run(conn);
      console.log(`Created database '${DB_NAME}'`);
    }

    // Create tables if not exist
    const tables = ['buildings', 'contacts', 'sensors', 'readings'];
    const existingTables = await r.db(DB_NAME).tableList().run(conn);

    for (const table of tables) {
      if (!existingTables.includes(table)) {
        await r.db(DB_NAME).tableCreate(table).run(conn);
        console.log(`Created table '${table}'`);
      }
    }

    // Create indexes
    await createIndex('buildings', 'governorate');
    await createIndex('buildings', 'type');
    await createIndex('contacts', 'building_id');
    await createIndex('sensors', 'building_id');
    await createIndex('readings', 'sensor_id');
    await createIndex('readings', 'timestamp');

  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

async function createIndex(table, index) {
  const indexList = await r.db(DB_NAME).table(table).indexList().run(conn);
  if (!indexList.includes(index)) {
    await r.db(DB_NAME).table(table).indexCreate(index).run(conn);
    await r.db(DB_NAME).table(table).indexWait(index).run(conn);
    console.log(`Created index ${table}.${index}`);
  }
}

// Connection with retries
async function connectDB() {
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const connection = await r.connect({ 
        host: DB_HOST, 
        port: DB_PORT,
        db: DB_NAME
      });
      
      connection.on('error', (err) => {
        console.error('Connection error:', err);
        conn = null;
      });

      console.log('✅ Connected to RethinkDB');
      return connection;
    } catch (err) {
      retryCount++;
      console.warn(`Connection attempt ${retryCount}/${maxRetries} failed`);
      if (retryCount === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: conn && conn.open ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint
app.get('/debug', async (req, res) => {
  try {
    if (!conn || !conn.open) throw new Error('No database connection');
    
    const dbInfo = {
      database: DB_NAME,
      tables: {}
    };

    const tables = await r.db(DB_NAME).tableList().run(conn);
    
    for (const table of tables) {
      dbInfo.tables[table] = {
        count: await r.db(DB_NAME).table(table).count().run(conn),
        indexes: await r.db(DB_NAME).table(table).indexList().run(conn)
      };
    }

    res.json({
      status: 'healthy',
      ...dbInfo
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Buildings endpoint
app.get('/buildings', async (req, res) => {
  try {
    if (!conn || !conn.open) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const cursor = await r.db(DB_NAME).table('buildings').run(conn);
    const results = await cursor.toArray();
    
    if (results.length === 0) {
      console.warn('No buildings found - is the database populated?');
    }

    res.json(results);
  } catch (err) {
    console.error('Buildings endpoint error:', err);
    res.status(500).json({ 
      error: err.message,
      details: 'Failed to query buildings'
    });
  }
});

// Start server
async function startServer() {
  try {
    conn = await connectDB();
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('➡️  Health check: http://localhost:' + PORT + '/health');
      console.log('➡️  Debug info: http://localhost:' + PORT + '/debug');
      console.log('➡️  Buildings: http://localhost:' + PORT + '/buildings');
    });

  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  if (conn && conn.open) await conn.close();
  process.exit(0);
});

startServer();