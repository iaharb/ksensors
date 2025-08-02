// server/db.js
const r = require('rethinkdb');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'rethinkdb',
  port: process.env.DB_PORT || 28015,
  db: process.env.DB_NAME || 'sensors'
};

async function getConnection() {
  return await r.connect(DB_CONFIG);
}

async function setupDatabase() {
  let conn;
  try {
    conn = await getConnection();
    
    // Check if database exists
    const dbList = await r.dbList().run(conn);
    if (!dbList.includes(DB_CONFIG.db)) {
      await r.dbCreate(DB_CONFIG.db).run(conn);
      console.log(`Created database "${DB_CONFIG.db}"`);
    }

    // Use the database
    await conn.use(DB_CONFIG.db);

    // Create tables if they don't exist
    const tables = ['buildings', 'contacts', 'sensors', 'readings'];
    const tableList = await r.tableList().run(conn);
    
    for (const table of tables) {
      if (!tableList.includes(table)) {
        await r.tableCreate(table).run(conn);
        console.log(`Created table "${table}"`);
      }
    }

  } finally {
    if (conn) conn.close();
  }
}

module.exports = { getConnection, setupDatabase };