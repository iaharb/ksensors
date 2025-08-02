const r = require('rethinkdb');
const moment = require('moment');
const express = require('express');

// Configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 28015;
const DB_NAME = 'sensors';
const READING_PREFIX = 'rdg-';
const PORT = process.env.PORT || 3030;
const INTERVAL_MINUTES = process.env.INTERVAL_MINUTES || 60;

// Sensor value generators
const SENSOR_GENERATORS = {
  temperature: () => {
    const hour = new Date().getHours();
    // Temperature varies by time of day (colder at night, warmer during day)
    const baseTemp = 25 + (5 * Math.sin((hour - 12) * Math.PI / 12));
    return baseTemp + (3 * Math.random() - 1.5); // Add some randomness
  },
  humidity: () => 50 + (10 * Math.random()), // Between 50-60%
  fire_alarm: () => Math.random() > 0.999, // Very rare false positives (0.1% chance)
  co2: () => 400 + (100 * Math.random()), // Normal indoor levels
  pressure: () => 100 + (2 * Math.random()), // Normal atmospheric pressure
  water_leak: () => Math.random() > 0.9995 // Very rare (0.05% chance)
};

async function connectDB() {
  return await r.connect({ host: DB_HOST, port: DB_PORT });
}

async function getActiveSensors(conn) {
  const cursor = await r.db(DB_NAME)
    .table('sensors')
    .filter({ status: 'active' })
    .run(conn);
  
  return await cursor.toArray();
}

async function generateReading(sensor) {
  const value = SENSOR_GENERATORS[sensor.type]();
  
  return {
    reading_id: `${READING_PREFIX}${require('crypto').randomUUID()}`,
    sensor_id: sensor.sensor_id,
    building_id: sensor.building_id,
    value: sensor.type.includes('_alarm') || sensor.type === 'water_leak' 
      ? value 
      : parseFloat(value.toFixed(2)),
    unit: sensor.unit,
    timestamp: new Date(),
    created_at: new Date()
  };
}

async function recordReadings(conn, sensors) {
  const readings = await Promise.all(sensors.map(generateReading));
  
  await r.db(DB_NAME)
    .table('readings')
    .insert(readings)
    .run(conn);
  
  console.log(`Recorded ${readings.length} readings at ${new Date().toISOString()}`);
  return readings;
}

async function runScheduledUpdates() {
  let conn;
  try {
    conn = await connectDB();
    const sensors = await getActiveSensors(conn);
    await recordReadings(conn, sensors);
  } catch (err) {
    console.error('Error recording readings:', err);
  } finally {
    if (conn) conn.close();
  }
}

// Start the server
function startServer() {
  const app = express();
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy',
      nextReading: moment().add(INTERVAL_MINUTES, 'minutes').format()
    });
  });
  
  // Start the scheduled updates
  setInterval(runScheduledUpdates, INTERVAL_MINUTES * 60 * 1000);
  
  // Initial run
  runScheduledUpdates();
  
  app.listen(PORT, () => {
    console.log(`Sensor streaming server running on port ${PORT}`);
    console.log(`Recording readings every ${INTERVAL_MINUTES} minutes`);
  });
}

startServer();