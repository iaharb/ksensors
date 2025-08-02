const BUILDING_PREFIX = 'bld-';
const SENSOR_PREFIX = 'sns-';
const CONTACT_PREFIX = 'cnt-';
const READING_PREFIX = 'rdg-';
const r = require('rethinkdb');
const faker = require('faker');
const moment = require('moment');

// Configuration
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 28015;
const DB_NAME = 'sensors';

// Updated Kuwait-specific data with accurate coordinates
const GOVERNORATES = [
  { name: 'Capital', lat: 29.334167, long: 47.981389 }, // Kuwait City coordinates
  { name: 'Hawalli', lat: 29.305556, long: 48.030833 }, // Hawalli District
  { name: 'Farwaniya', lat: 29.2770, long: 47.9333 }, // Al Farwaniya City
  { name: 'Mubarak Al-Kabeer', lat: 29.225, long: 48.083 }, // Approximate center
  { name: 'Ahmadi', lat: 29.083056, long: 48.083056 }, // Ahmadi coordinates
  { name: 'Jahra', lat: 29.336573, long: 47.675529 } // Al-Jahra coordinates
];

const DISTRICTS = {
  'Capital': [
    { name: 'Kuwait City', lat: 29.334167, long: 47.981389 },
    { name: 'Sharq', lat: 29.358333, long: 48.0 },
    { name: 'Mirqab', lat: 29.366667, long: 47.966667 },
    { name: 'Dasma', lat: 29.366667, long: 47.966667 }
  ],
  'Hawalli': [
    { name: 'Hawalli', lat: 29.305556, long: 48.030833 },
    { name: 'Salmiya', lat: 29.333333, long: 48.083333 },
    { name: 'Bayyan', lat: 29.316667, long: 48.033333 },
    { name: 'Mishref', lat: 29.266667, long: 48.083333 }
  ],
  'Farwaniya': [
    { name: 'Farwaniya', lat: 29.2770, long: 47.9333 },
    { name: 'Ardiya', lat: 29.316667, long: 47.933333 },
    { name: 'Jleeb', lat: 29.266667, long: 47.966667 },
    { name: 'Khaitan', lat: 29.283333, long: 47.966667 }
  ],
  'Mubarak Al-Kabeer': [
    { name: 'Adan', lat: 29.216667, long: 48.083333 },
    { name: 'Mubarak Al-Kabeer', lat: 29.225, long: 48.083 },
    { name: 'Qurain', lat: 29.266667, long: 48.083333 },
    { name: 'Sabah Al-Salem', lat: 29.25, long: 48.083333 }
  ],
  'Ahmadi': [
    { name: 'Ahmadi', lat: 29.083056, long: 48.083056 },
    { name: 'Fahaheel', lat: 29.083333, long: 48.133333 },
    { name: 'Mangaf', lat: 29.1, long: 48.133333 },
    { name: 'Abu Halifa', lat: 29.116667, long: 48.133333 }
  ],
  'Jahra': [
    { name: 'Jahra', lat: 29.336573, long: 47.675529 },
    { name: 'Taima', lat: 29.316667, long: 47.7 },
    { name: 'Naeem', lat: 29.3, long: 47.716667 },
    { name: 'Sulaibiya', lat: 29.283333, long: 47.783333 }
  ]
};

// Sensor configuration
const SENSOR_TYPES = ['temperature', 'humidity', 'fire_alarm', 'co2', 'pressure', 'water_leak'];
const UNITS = {
  temperature: '°C',
  humidity: '%',
  fire_alarm: 'boolean',
  co2: 'ppm',
  pressure: 'kPa',
  water_leak: 'boolean'
};

async function connectDB() {
  return await r.connect({ host: DB_HOST, port: DB_PORT });
}

async function setupDatabase(conn) {
  try {
    // Create database if not exists
    const dbList = await r.dbList().run(conn);
    if (!dbList.includes(DB_NAME)) {
      await r.dbCreate(DB_NAME).run(conn);
      console.log(`Created database "${DB_NAME}"`);
    }

    // Table definitions
    const tables = {
      buildings: { primaryKey: 'building_id' },
      contacts: { primaryKey: 'contact_id' },
      sensors: { primaryKey: 'sensor_id' },
      readings: { primaryKey: 'reading_id' }
    };

    // Create tables
    const tableList = await r.db(DB_NAME).tableList().run(conn);
    for (const [table, options] of Object.entries(tables)) {
      if (!tableList.includes(table)) {
        await r.db(DB_NAME).tableCreate(table, options).run(conn);
        console.log(`Created table "${table}"`);
      }
    }

    // Create indexes
    const indexes = {
      buildings: ['governorate', 'district', 'type'],
      contacts: ['building_id', 'role'],
      sensors: ['building_id', 'type', 'installation_date'],
      readings: ['sensor_id', 'timestamp', 'building_id']
    };

    for (const [table, tableIndexes] of Object.entries(indexes)) {
      for (const index of tableIndexes) {
        await createIndex(conn, table, index);
      }
    }

  } catch (err) {
    console.error('Database setup failed:', err);
    throw err;
  }
}

async function createIndex(conn, table, index) {
  const indexList = await r.db(DB_NAME).table(table).indexList().run(conn);
  if (!indexList.includes(index)) {
    await r.db(DB_NAME).table(table).indexCreate(index).run(conn);
    await r.db(DB_NAME).table(table).indexWait(index).run(conn);
    console.log(`Created index ${table}.${index}`);
  }
}

async function generateBuildings(conn, count = 150) {
  const buildings = [];
  for (let i = 0; i < count; i++) {
    const gov = GOVERNORATES[Math.floor(Math.random() * GOVERNORATES.length)];
    const districtData = DISTRICTS[gov.name][Math.floor(Math.random() * DISTRICTS[gov.name].length)];
    
    // Generate random point within 2km of district center (approx 0.02 degrees)
    const lat = districtData.lat + (Math.random() * 0.02 - 0.01);
    const long = districtData.long + (Math.random() * 0.02 - 0.01);
    
    buildings.push({
      building_id: `${BUILDING_PREFIX}${1000 + i}`,
      type: Math.random() > 0.7 ? 'public' : 'private',
      location: {
        lat: parseFloat(lat.toFixed(6)),
        long: parseFloat(long.toFixed(6))
      },
      governorate: gov.name,
      district: districtData.name,
      area: faker.address.streetName(),
      street_address: faker.address.streetAddress(),
      created_at: new Date()
    });
  }
  
  await r.db(DB_NAME).table('buildings').insert(buildings).run(conn);
  console.log(`Inserted ${buildings.length} buildings`);
  return buildings;
}

async function generateContacts(conn, buildings) {
  const contacts = [];
  const roles = ['manager', 'technician', 'security', 'supervisor'];
  
  buildings.forEach(building => {
    const contactCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < contactCount; i++) {
      contacts.push({
        contact_id: `${CONTACT_PREFIX}${faker.datatype.uuid()}`,
        building_id: building.building_id,
        full_name: faker.name.findName(),
        role: roles[Math.floor(Math.random() * roles.length)],
        phone: faker.phone.phoneNumber('+9655#######'),
        email: faker.internet.email(),
        workshift: Math.random() > 0.5 ? 'day' : 'night',
        created_at: new Date()
      });
    }
  });

  await r.db(DB_NAME).table('contacts').insert(contacts).run(conn);
  console.log(`Inserted ${contacts.length} contacts`);
  return contacts;
}

async function generateSensors(conn, buildings) {
  const sensors = [];
  
  buildings.forEach(building => {
    for (let i = 0; i < 3; i++) {
      const type = SENSOR_TYPES[Math.floor(Math.random() * SENSOR_TYPES.length)];
      sensors.push({
        sensor_id: `${SENSOR_PREFIX}${faker.datatype.uuid()}`,
        building_id: building.building_id,
        type: type,
        unit: UNITS[type],
        installation_date: faker.date.past(2),
        warranty_years: 1 + Math.floor(Math.random() * 4),
        status: 'active',
        created_at: new Date()
      });
    }
  });

  await r.db(DB_NAME).table('sensors').insert(sensors).run(conn);
  console.log(`Inserted ${sensors.length} sensors`);
  return sensors;
}

async function generateReadings(conn, sensors) {
  const readings = [];
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  for (const sensor of sensors) {
    let currentDate = new Date(twoYearsAgo);
    
    while (currentDate <= now) {
      const month = currentDate.getMonth();
      let value;
      
      switch(sensor.type) {
        case 'temperature':
          value = 20 + 15 * Math.sin((month - 3) * Math.PI / 6) + 5 * Math.random();
          break;
        case 'humidity':
          value = 50 + 15 * Math.sin((month - 6) * Math.PI / 6) + 5 * Math.random();
          break;
        case 'fire_alarm':
          value = Math.random() > 0.99;
          break;
        case 'co2':
          value = 400 + 200 * Math.random();
          break;
        case 'pressure':
          value = 100 + 5 * Math.random();
          break;
        case 'water_leak':
          value = Math.random() > 0.995;
          break;
      }

      readings.push({
        reading_id: `${READING_PREFIX}${faker.datatype.uuid()}`,
        sensor_id: sensor.sensor_id,
        building_id: sensor.building_id,
        value: sensor.type.includes('_alarm') || sensor.type === 'water_leak' ? value : parseFloat(value.toFixed(2)),
        unit: sensor.unit,
        timestamp: currentDate,
        created_at: new Date()
      });

      currentDate = new Date(currentDate.getTime() + 86400000); // Next day
    }
  }

  // Batch insert readings
  const batchSize = 5000;
  for (let i = 0; i < readings.length; i += batchSize) {
    const batch = readings.slice(i, i + batchSize);
    await r.db(DB_NAME).table('readings').insert(batch).run(conn);
    console.log(`Inserted ${Math.min(i + batchSize, readings.length)} of ${readings.length} readings`);
  }

  console.log(`Total readings generated: ${readings.length}`);
  return readings;
}

async function main() {
  let conn;
  try {
    conn = await connectDB();
    await setupDatabase(conn);
    
    console.log('Generating sample data...');
    const buildings = await generateBuildings(conn);
    const contacts = await generateContacts(conn, buildings);
    const sensors = await generateSensors(conn, buildings);
    await generateReadings(conn, sensors);
    
    console.log('✅ Data generation complete!');
    console.log(`🏢 Buildings: ${buildings.length}`);
    console.log(`📞 Contacts: ${contacts.length}`);
    console.log(`📡 Sensors: ${sensors.length}`);
    
  } catch (err) {
    console.error('❌ Data generation failed:', err);
    process.exit(1);
  } finally {
    if (conn) conn.close();
  }
}

main();