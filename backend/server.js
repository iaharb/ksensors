// server/server.js
const express = require('express');
const r = require('rethinkdb');
const app = express();
const routes = require('./routes');

require('dotenv').config();
const app = require('./app.js');
const DataGenerator = require('./scripts/dataGenerator');
const { setupDatabase } = require('./db');

const PORT = process.env.PORT || 3001;
const AUTO_START_GENERATION = process.env.AUTO_START_GENERATION === 'true';
const GENERATE_HISTORICAL = process.env.GENERATE_HISTORICAL === 'true';

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

// Use routes
app.use('/api', routes);  // Now all routes are under /api (e.g., /api/sensors)

// Error handler
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

class Server {
  constructor() { 
    this.dataGenerator = new DataGenerator();
    this.server = null;
  }

  async start() {
    try {
      console.log('Initializing database...');
      await setupDatabase();

      // Attach data generator to app for route access
      app.set('dataGenerator', this.dataGenerator);

      if (AUTO_START_GENERATION) {
        console.log('Starting data generation...');
        await this.dataGenerator.initialize(GENERATE_HISTORICAL);
      }

      this.server = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Data generation: ${AUTO_START_GENERATION ? 'ON' : 'OFF'}`);
        if (AUTO_START_GENERATION) {
          console.log(`Historical data: ${GENERATE_HISTORICAL ? 'GENERATED' : 'SKIPPED'}`);
        }
      });

      this.setupGracefulShutdown();
    } catch (err) {
      console.error('Server startup failed:', err);
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async shutdown() {
    console.log('\nShutting down server...');
    
    try {
      await this.dataGenerator.disconnect();
      if (this.server) {
        this.server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    } catch (err) {
      console.error('Shutdown error:', err);
      process.exit(1);
    }
  }
}

// Start the server
new Server().start();