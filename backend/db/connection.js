import rethinkdbdash from 'rethinkdbdash';

const r = rethinkdbdash({
  servers: [{
    host: process.env.RETHINKDB_HOST || 'localhost',
    port: parseInt(process.env.RETHINKDB_PORT) || 28015,
    db: process.env.RETHINKDB_DB || 'ksensors'  // Add this line
  }],
  pool: true,
  max: 50  // Adjust based on your expected load
});

export default r;