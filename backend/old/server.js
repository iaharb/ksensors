const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rethinkdb = require('rethinkdb');
const r = rethinkdb; // For query building

const app = express();
const port = process.env.HTTP_PORT || 3000;
const dbConfig = {
  host: process.env.RETHINKDB_HOST || 'rethinkdb',
  port: process.env.RETHINKDB_PORT || 28015,
  db: process.env.RETHINKDB_DB || 'ksensors'
};

// Middleware
app.use(cors({
  origin: ['http://localhost:8088', 'http://frontend:8088'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Database connection setup
let conn;
async function connectToDB() {
  try {
    conn = await rethinkdb.connect(dbConfig);
    console.log('Connected to RethinkDB');
    
    // Set up database and tables if they don't exist
    await setupDatabase();
    
    return conn;
  } catch (err) {
    console.error('Could not connect to RethinkDB:', err);
    process.exit(1);
  }
}

async function setupDatabase() {
  // Check if database exists, create if not
  const dbList = await r.dbList().run(conn);
  if (!dbList.includes(dbConfig.db)) {
    await r.dbCreate(dbConfig.db).run(conn);
    console.log(`Created database: ${dbConfig.db}`);
  }

  // Check and create tables
  const tableList = await r.db(dbConfig.db).tableList().run(conn);
  const requiredTables = ['buildings', 'sensors', 'contacts', 'readings'];
  
  for (const table of requiredTables) {
    if (!tableList.includes(table)) {
      await r.db(dbConfig.db).tableCreate(table).run(conn);
      console.log(`Created table: ${table}`);
      
      // Add secondary indexes if needed
      if (table === 'sensors') {
        await r.db(dbConfig.db).table(table).indexCreate('building_id').run(conn);
      }
    }
  }
}

// Connect to database when starting
connectToDB().then(() => {
  // Start server after DB connection is established
  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });
});

// Middleware to ensure DB connection is available
app.use(async (req, res, next) => {
  if (!conn) {
    try {
      conn = await connectToDB();
      next();
    } catch (err) {
      res.status(503).json({ error: 'Database connection unavailable' });
    }
  } else {
    next();
  }
});

// Helper function to handle errors
function handleError(res, message, error) {
  console.error(message, error);
  res.status(500).json({ 
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

// Add this endpoint before your other routes
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dbStatus: 'connected' // You can add DB connection check here
  });
});

app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await r.db(process.env.DB_NAME).tableList().run(conn);
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      dbStatus: 'connected'
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      dbStatus: 'disconnected',
      error: err.message
    });
  }
});

// ========== BUILDINGS ENDPOINTS ==========
app.post('/buildings', async (req, res) => {
  try {
    const result = await r.table('buildings').insert({
      building_id: r.uuid().do(id => 'bld-' + id),
      ...req.body,
      created_at: r.now()
    }).run(conn);

    res.json({
      success: true,
      id: result.generated_keys ? result.generated_keys[0] : null,
      message: 'Building created successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to create building', err);
  }
});

app.get('/buildings', async (req, res) => {
  try {
    const cursor = await r.table('buildings').run(conn);
    const buildings = await cursor.toArray();
    res.json(buildings);
  } catch (err) {
    handleError(res, 'Failed to fetch buildings', err);
  }
});

app.get('/buildings/:id', async (req, res) => {
  try {
    const building = await r.table('buildings')
      .get(req.params.id)
      .run(conn);
    
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }
    
    res.json(building);
  } catch (err) {
    handleError(res, 'Failed to fetch building', err);
  }
});

app.put('/buildings/:id', async (req, res) => {
  try {
    const result = await r.table('buildings')
      .get(req.params.id)
      .update(req.body)
      .run(conn);
    
    res.json({ 
      success: true, 
      changes: result.changes,
      message: 'Building updated successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to update building', err);
  }
});

app.delete('/buildings/:id', async (req, res) => {
  try {
    const result = await r.table('buildings')
      .get(req.params.id)
      .delete()
      .run(conn);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: 'Building deleted successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to delete building', err);
  }
});

// ========== SENSORS ENDPOINTS ==========
app.post('/sensors', async (req, res) => {
  try {
    const result = await r.table('sensors').insert({
      sensor_id: r.uuid().do(id => 'sns-' + id),
      ...req.body,
      created_at: r.now()
    }).run(conn);

    res.json({
      success: true,
      id: result.generated_keys ? result.generated_keys[0] : null,
      message: 'Sensor created successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to create sensor', err);
  }
});

app.get('/sensors', async (req, res) => {
  try {
    const cursor = await r.table('sensors').run(conn);
    const sensors = await cursor.toArray();
    res.json(sensors);
  } catch (err) {
    handleError(res, 'Failed to fetch sensors', err);
  }
});

app.get('/sensors/:id', async (req, res) => {
  try {
    const sensor = await r.table('sensors')
      .get(req.params.id)
      .run(conn);
    
    if (!sensor) {
      return res.status(404).json({ error: 'Sensor not found' });
    }
    
    res.json(sensor);
  } catch (err) {
    handleError(res, 'Failed to fetch sensor', err);
  }
});

app.put('/sensors/:id', async (req, res) => {
  try {
    const result = await r.table('sensors')
      .get(req.params.id)
      .update(req.body)
      .run(conn);
    
    res.json({ 
      success: true, 
      changes: result.changes,
      message: 'Sensor updated successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to update sensor', err);
  }
});

app.delete('/sensors/:id', async (req, res) => {
  try {
    const result = await r.table('sensors')
      .get(req.params.id)
      .delete()
      .run(conn);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: 'Sensor deleted successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to delete sensor', err);
  }
});

// ========== CONTACTS ENDPOINTS ==========
app.post('/contacts', async (req, res) => {
  try {
    const result = await r.table('contacts').insert({
      contact_id: r.uuid().do(id => 'cnt-' + id),
      ...req.body,
      created_at: r.now()
    }).run(conn);

    res.json({
      success: true,
      id: result.generated_keys ? result.generated_keys[0] : null,
      message: 'Contact created successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to create contact', err);
  }
});

app.get('/contacts', async (req, res) => {
  try {
    const cursor = await r.table('contacts').run(conn);
    const contacts = await cursor.toArray();
    res.json(contacts);
  } catch (err) {
    handleError(res, 'Failed to fetch contacts', err);
  }
});

app.get('/contacts/:id', async (req, res) => {
  try {
    const contact = await r.table('contacts')
      .get(req.params.id)
      .run(conn);
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    
    res.json(contact);
  } catch (err) {
    handleError(res, 'Failed to fetch contact', err);
  }
});

app.put('/contacts/:id', async (req, res) => {
  try {
    const result = await r.table('contacts')
      .get(req.params.id)
      .update(req.body)
      .run(conn);
    
    res.json({ 
      success: true, 
      changes: result.changes,
      message: 'Contact updated successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to update contact', err);
  }
});

app.delete('/contacts/:id', async (req, res) => {
  try {
    const result = await r.table('contacts')
      .get(req.params.id)
      .delete()
      .run(conn);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: 'Contact deleted successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to delete contact', err);
  }
});

// ========== READINGS ENDPOINTS ==========
app.post('/readings', async (req, res) => {
  try {
    const result = await r.table('readings').insert({
      reading_id: r.uuid().do(id => 'rdg-' + id),
      ...req.body,
      timestamp: r.now()
    }).run(conn);

    res.json({
      success: true,
      id: result.generated_keys ? result.generated_keys[0] : null,
      message: 'Reading created successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to create reading', err);
  }
});

app.get('/readings', async (req, res) => {
  try {
    let query = r.table('readings');
    
    // Add filters if provided
    if (req.query.sensor_id) {
      query = query.filter({ sensor_id: req.query.sensor_id });
    }
    if (req.query.limit) {
      query = query.limit(parseInt(req.query.limit));
    }
    if (req.query.orderBy) {
      query = query.orderBy(r.desc(req.query.orderBy));
    }

    const cursor = await query.run(conn);
    const readings = await cursor.toArray();
    res.json(readings);
  } catch (err) {
    handleError(res, 'Failed to fetch readings', err);
  }
});

app.get('/readings/:id', async (req, res) => {
  try {
    const reading = await r.table('readings')
      .get(req.params.id)
      .run(conn);
    
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }
    
    res.json(reading);
  } catch (err) {
    handleError(res, 'Failed to fetch reading', err);
  }
});

app.delete('/readings/:id', async (req, res) => {
  try {
    const result = await r.table('readings')
      .get(req.params.id)
      .delete()
      .run(conn);
    
    res.json({ 
      success: true, 
      deleted: result.deleted,
      message: 'Reading deleted successfully'
    });
  } catch (err) {
    handleError(res, 'Failed to delete reading', err);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Handle database connection errors
process.on('SIGINT', async () => {
  if (conn) {
    await conn.close();
    console.log('Database connection closed');
  }
  process.exit();
});