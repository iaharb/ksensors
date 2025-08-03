import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import initDB from './db/init.js';
import r from './db/connection.js';  // Connection pool instance

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
// const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Database initialization wrapper
async function startServer() {
  try {
    // Get port from environment variables
    const PORT = process.env.API_PORT || 3001;

    // Initialize database (create tables if needed)
    await initDB();
    
    // ================== CRUD Routes ================== //
    
    // Generic CRUD handler factory
    const createCRUDRoutes = (tableName) => {
      const router = express.Router();
      
      // GET all items
      router.get('/', async (req, res) => {
        try {
          const items = await r.table(tableName).run();
          res.json(items);
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
      
      // GET single item
      router.get('/:id', async (req, res) => {
        try {
          const item = await r.table(tableName).get(req.params.id).run();
          item ? res.json(item) : res.status(404).json({ error: 'Not found' });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
      
      // POST create item
      router.post('/', async (req, res) => {
        try {
          const result = await r.table(tableName).insert(req.body).run();
          res.status(201).json({
            id: result.generated_keys?.[0],
            message: 'Created successfully'
          });
        } catch (err) {
          res.status(400).json({ error: err.message });
        }
      });
      
      // PUT update item
      router.put('/:id', async (req, res) => {
        try {
          const result = await r.table(tableName)
            .get(req.params.id)
            .update(req.body)
            .run();
            
          result.replaced === 1
            ? res.json({ message: 'Updated successfully' })
            : res.status(404).json({ error: 'Not found' });
        } catch (err) {
          res.status(400).json({ error: err.message });
        }
      });
      
      // DELETE item
      router.delete('/:id', async (req, res) => {
        try {
          const result = await r.table(tableName)
            .get(req.params.id)
            .delete()
            .run();
            
          result.deleted === 1
            ? res.json({ message: 'Deleted successfully' })
            : res.status(404).json({ error: 'Not found' });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });
      
      return router;
    };

    // Register CRUD routes
    app.use('/api/sensors', createCRUDRoutes('sensors'));
    app.use('/api/buildings', createCRUDRoutes('buildings'));
    app.use('/api/contacts', createCRUDRoutes('contacts'));
    app.use('/api/readings', createCRUDRoutes('readings'));

    // ============== PowerBI Endpoint ================ //
    app.get('/api/powerbi/sensors', async (req, res) => {
      try {
        const sensors = await r.table('sensors').run();
        res.json(sensors);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ============== Health Check ==================== //
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'UP',
        database: r.getPoolMaster().getPools().length > 0 ? 'CONNECTED' : 'DISCONNECTED'
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 PowerBI endpoint: http://localhost:${PORT}/api/powerbi/sensors`);
      console.log(`🩺 Health check: http://localhost:${PORT}/health`);
    });

  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
}

// Start the application
startServer();