import r from './connection.js';

const TABLES = ['sensors', 'buildings', 'contacts', 'readings'];

export default async function initDB() {
  try {
    // Get database name from environment or use default
    const dbName = process.env.RETHINKDB_DB || 'ksensors';
    console.log(`Initializing database: ${dbName}`);

    // Check if database exists
    const dbList = await r.dbList().run();
    if (!dbList.includes(dbName)) {
      console.log(`Creating database: ${dbName}`);
      await r.dbCreate(dbName).run();
    }
    // Switch context to our database
    r.db(dbName);

    // Create tables
    const existingTables = await r.tableList().run();
    await Promise.all(TABLES.map(table => {
      if (!existingTables.includes(table)) {
        console.log(`Creating table: ${table}`);
        return r.tableCreate(table).run();
      }
      return Promise.resolve();
    }));

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);  // Exit on critical DB errors
  }
}