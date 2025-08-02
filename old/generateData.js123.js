const r = require('rethinkdb');
const faker = require('faker');
const moment = require('moment');

async function setupDatabase() {
  const conn = await r.connect({ host: 'localhost', port: 28015 });
  
  try {
    // Create database if not exists
    const dbList = await r.dbList().run(conn);
    if (!dbList.includes('sensors')) {
      await r.dbCreate('sensors').run(conn);
      console.log('Created database "sensors"');
    }

    // Create tables with proper structure
    const tableList = await r.db('sensors').tableList().run(conn);
    
    if (!tableList.includes('buildings')) {
      await r.db('sensors').tableCreate('buildings', {primaryKey: 'building_id'}).run(conn);
      console.log('Created table "buildings"');
    }
    
    if (!tableList.includes('contacts')) {
      await r.db('sensors').tableCreate('contacts', {primaryKey: 'contact_id'}).run(conn);
      console.log('Created table "contacts"');
    }
    
    if (!tableList.includes('sensors')) {
      await r.db('sensors').tableCreate('sensors', {primaryKey: 'sensor_id'}).run(conn);
      console.log('Created table "sensors"');
    }
    
    if (!tableList.includes('readings')) {
      await r.db('sensors').tableCreate('readings').run(conn);
      console.log('Created table "readings"');
    }

    // Create indexes if they don't exist
    await createIndexIfNotExists(conn, 'buildings', 'governorate');
    await createIndexIfNotExists(conn, 'buildings', 'district');
    await createIndexIfNotExists(conn, 'buildings', 'type');
    
    await createIndexIfNotExists(conn, 'contacts', 'building_id');
    await createIndexIfNotExists(conn, 'contacts', 'role');
    
    await createIndexIfNotExists(conn, 'sensors', 'building_id');
    await createIndexIfNotExists(conn, 'sensors', 'type');
    await createIndexIfNotExists(conn, 'sensors', 'installation_date');
    
    await createIndexIfNotExists(conn, 'readings', 'sensor_id');
    await createIndexIfNotExists(conn, 'readings', 'timestamp');
    await createIndexIfNotExists(conn, 'readings', 'building_id');

  } finally {
    conn.close();
  }
}

async function createIndexIfNotExists(conn, table, index) {
  const indexList = await r.db('sensors').table(table).indexList().run(conn);
  if (!indexList.includes(index)) {
    await r.db('sensors').table(table).indexCreate(index).run(conn);
    await r.db('sensors').table(table).indexWait(index).run(conn);
    console.log(`Created index ${table}.${index}`);
  }
}

async function generateData() {
  const conn = await r.connect({ host: 'localhost', port: 28015 });
  
  try {
    // First setup database structure
    await setupDatabase();
    
    // [Rest of your existing data generation code...]
    // Kuwait governorates and districts
    const governorates = ['Capital', 'Hawalli', 'Farwaniya', 'Mubarak Al-Kabeer', 'Ahmadi', 'Jahra'];
    const districts = {
      'Capital': ['Kuwait City', 'Sharq', 'Mirqab', 'Dasma'],
      'Hawalli': ['Hawalli', 'Salmiya', 'Bayyan', 'Mishref'],
      'Farwaniya': ['Farwaniya', 'Ardiya', 'Jleeb', 'Khaitan'],
      'Mubarak Al-Kabeer': ['Adan', 'Mubarak Al-Kabeer', 'Qurain', 'Sabah Al-Salem'],
      'Ahmadi': ['Ahmadi', 'Fahaheel', 'Mangaf', 'Abu Halifa'],
      'Jahra': ['Jahra', 'Taima', 'Naeem', 'Sulaibiya']
    };

    // Generate 150 buildings
    console.log('Generating buildings data...');
    const buildings = [];
    for (let i = 0; i < 150; i++) {
      const gov = governorates[Math.floor(Math.random() * governorates.length)];
      const districtList = districts[gov];
      const district = districtList[Math.floor(Math.random() * districtList.length)];
      
      buildings.push({
        building_id: `bld-${1000 + i}`,
        type: Math.random() > 0.7 ? 'public' : 'private',
        location: {
          lat: 29.3 + Math.random() * 0.5, // Kuwait latitude range
          long: 47.8 + Math.random() * 0.6 // Kuwait longitude range
        },
        governorate: gov,
        district: district,
        area: faker.address.streetName(),
        street_address: faker.address.streetAddress(),
        created_at: new Date()
      });
    }

    await r.db('sensors').table('buildings').insert(buildings).run(conn);
    console.log(`Inserted ${buildings.length} buildings`);

    // Generate contacts (2-4 per building)
    console.log('Generating contacts data...');
    const contacts = [];
    const roles = ['manager', 'technician', 'security', 'supervisor'];
    
    buildings.forEach(building => {
      const contactCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < contactCount; i++) {
        contacts.push({
          contact_id: `cnt-${faker.datatype.uuid()}`,
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

    await r.db('sensors').table('contacts').insert(contacts).run(conn);
    console.log(`Inserted ${contacts.length} contacts`);

    // Generate sensors (3 per building)
    console.log('Generating sensors data...');
    const sensors = [];
    const sensorTypes = ['temperature', 'humidity', 'fire_alarm', 'co2', 'pressure', 'water_leak'];
    const units = {
      temperature: '°C',
      humidity: '%',
      fire_alarm: 'boolean',
      co2: 'ppm',
      pressure: 'kPa',
      water_leak: 'boolean'
    };

    buildings.forEach(building => {
      for (let i = 0; i < 3; i++) {
        const type = sensorTypes[Math.floor(Math.random() * sensorTypes.length)];
        sensors.push({
          sensor_id: `sns-${faker.datatype.uuid()}`,
          building_id: building.building_id,
          type: type,
          unit: units[type],
          installation_date: faker.date.past(2),
          warranty_years: 1 + Math.floor(Math.random() * 4),
          status: 'active',
          created_at: new Date()
        });
      }
    });

    await r.db('sensors').table('sensors').insert(sensors).run(conn);
    console.log(`Inserted ${sensors.length} sensors`);

    // Generate readings (2 years of daily data per sensor)
    console.log('Generating readings data (this may take several minutes)...');
    const readings = [];
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

    sensors.forEach(sensor => {
      let currentDate = new Date(twoYearsAgo);
      
      while (currentDate <= now) {
        // Seasonal variations
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
          reading_id: `rdg-${faker.datatype.uuid()}`,
          sensor_id: sensor.sensor_id,
          building_id: sensor.building_id,
          value: sensor.type.includes('_alarm') || sensor.type === 'water_leak' ? value : parseFloat(value.toFixed(2)),
          unit: sensor.unit,
          timestamp: currentDate,
          created_at: new Date()
        });

        // Move to next day
        currentDate = new Date(currentDate.getTime() + 86400000);
      }
    });

    // Batch insert readings (5000 at a time to avoid memory issues)
    const batchSize = 5000;
    for (let i = 0; i < readings.length; i += batchSize) {
      const batch = readings.slice(i, i + batchSize);
      await r.db('sensors').table('readings').insert(batch).run(conn);
      console.log(`Inserted ${i + batch.length} of ${readings.length} readings`);
    }

    console.log('Data generation complete!');
    console.log(`Total buildings: ${buildings.length}`);
    console.log(`Total contacts: ${contacts.length}`);
    console.log(`Total sensors: ${sensors.length}`);
    console.log(`Total readings: ${readings.length}`);

  } finally {
    conn.close();
  }
}

generateData().catch(err => {
  console.error('Error during data generation:', err);
  process.exit(1);
});