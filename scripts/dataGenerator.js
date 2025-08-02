// scripts/dataGenerator.js
const BUILDING_PREFIX = 'bld-';
const SENSOR_PREFIX = 'sns-';
const CONTACT_PREFIX = 'cnt-';
const READING_PREFIX = 'rdg-';
const r = require('rethinkdb');
const { faker } = require('@faker-js/faker/locale/en');
const moment = require('moment');

// Configuration with retry settings
const DB_CONFIG = {
  host: process.env.DB_HOST || 'rethinkdb',
  port: process.env.DB_PORT || 28015,
  db: process.env.DB_NAME || 'sensors',
  timeout: 60, // Increased timeout
  waitForHealthy: true // Wait for healthy connection
};

// Kuwait-specific data
const GOVERNORATES = [
  { name: 'Capital', lat: 29.334167, long: 47.981389 },
  { name: 'Hawalli', lat: 29.305556, long: 48.030833 },
  { name: 'Farwaniya', lat: 29.2770, long: 47.9333 },
  { name: 'Mubarak Al-Kabeer', lat: 29.225, long: 48.083 },
  { name: 'Ahmadi', lat: 29.083056, long: 48.083056 },
  { name: 'Jahra', lat: 29.336573, long: 47.675529 }
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

// Enhanced sensor statuses
const SENSOR_STATUSES = ['active', 'inactive', 'maintenance', 'faulty', 'offline'];
const STATUS_WEIGHTS = [0.85, 0.05, 0.04, 0.03, 0.03];

class DataGenerator {
  constructor() {
    this.conn = null;
    this.sensors = [];
    this.generationInterval = null;
    this.historicalDataGenerated = false;
  }

  async connectWithRetry(maxRetries = 10, retryDelay = 10000) {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const conn = await r.connect(DB_CONFIG);
        console.log('Successfully connected to database');
        return conn;
      } catch (err) {
        retryCount++;
        console.log(`Database connection failed (attempt ${retryCount}/${maxRetries}), retrying in ${retryDelay/1000}s...`);
        if (retryCount >= maxRetries) {
          throw new Error(`Could not connect to database after ${maxRetries} attempts: ${err.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async createTableWithRetry(tableName, options = {}) {
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const exists = await r.tableList().contains(tableName).run(this.conn);
        if (!exists) {
          await r.tableCreate(tableName, options).run(this.conn);
          console.log(`Created table "${tableName}"`);
        }
        return;
      } catch (err) {
        if (!err.message.includes('already exists')) {
          retryCount++;
          console.log(`Table creation failed (${tableName}), retrying... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          return;
        }
      }
    }
    throw new Error(`Failed to create table ${tableName} after retries`);
  }

  async waitForTableAvailability(tableName, maxRetries = 10, retryDelay = 5000) {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        await r.table(tableName).count().run(this.conn);
        return true;
      } catch (err) {
        retryCount++;
        console.log(`Waiting for table ${tableName} to be available... (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error(`Table ${tableName} not available after ${maxRetries} retries`);
  }

  async setupDatabase() {
    try {
      this.conn = await this.connectWithRetry();
      
      // Check if database exists
      const dbList = await r.dbList().run(this.conn);
      if (!dbList.includes(DB_CONFIG.db)) {
        console.log(`Creating database "${DB_CONFIG.db}"`);
        await r.dbCreate(DB_CONFIG.db).run(this.conn);
      }

      await this.conn.use(DB_CONFIG.db);

      // Create tables with retries
      const tables = [
        { name: 'buildings', options: { primaryKey: 'building_id', durability: 'soft' } },
        { name: 'contacts', options: { primaryKey: 'contact_id', durability: 'soft' } },
        { name: 'sensors', options: { primaryKey: 'sensor_id', durability: 'soft' } },
        { name: 'readings', options: { primaryKey: 'reading_id', durability: 'soft' } }
      ];

      for (const table of tables) {
        await this.createTableWithRetry(table.name, table.options);
        await this.waitForTableAvailability(table.name);
      }

      // Create indexes
      const indexes = {
        buildings: ['governorate', 'district', 'type'],
        contacts: ['building_id', 'role'],
        sensors: ['building_id', 'type', 'installation_date'],
        readings: ['sensor_id', 'timestamp', 'building_id']
      };

      for (const [table, tableIndexes] of Object.entries(indexes)) {
        const existingIndexes = await r.table(table).indexList().run(this.conn);
        for (const index of tableIndexes) {
          if (!existingIndexes.includes(index)) {
            await r.table(table).indexCreate(index).run(this.conn);
            await r.table(table).indexWait(index).run(this.conn);
          }
        }
      }

    } catch (err) {
      console.error('Database setup failed:', err);
      throw err;
    }
  }

  async insertWithRetry(table, data, maxRetries = 5, retryDelay = 5000) {
    let retryCount = 0;
    while (retryCount < maxRetries) {
      try {
        await r.table(table).insert(data).run(this.conn);
        return;
      } catch (err) {
        retryCount++;
        console.log(`Insert failed (${table}), retrying... (${retryCount}/${maxRetries})`);
        if (retryCount >= maxRetries) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  async generateBuildings(count = 150) {
    const buildings = [];
    const buildingTypes = ['residential', 'commercial', 'industrial', 'government'];
    const maintenanceStatuses = ['excellent', 'good', 'fair', 'poor', 'critical'];
    
    for (let i = 0; i < count; i++) {
      const gov = GOVERNORATES[Math.floor(Math.random() * GOVERNORATES.length)];
      const districtData = DISTRICTS[gov.name][Math.floor(Math.random() * DISTRICTS[gov.name].length)];
      
      const lat = districtData.lat + (Math.random() * 0.02 - 0.01);
      const long = districtData.long + (Math.random() * 0.02 - 0.01);
      
      const buildingAge = Math.floor(Math.random() * 30);
      const floorCount = Math.max(1, Math.floor(Math.random() * 20));
      const maintenanceStatus = maintenanceStatuses[Math.floor(Math.random() * maintenanceStatuses.length)];
      const buildingType = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
      
      buildings.push({
        building_id: `${BUILDING_PREFIX}${1000 + i}`,
        type: buildingType,
        location: {
          lat: parseFloat(lat.toFixed(6)),
          long: parseFloat(long.toFixed(6))
        },
        governorate: gov.name,
        district: districtData.name,
        area: faker.location.street(),
        street_address: faker.location.streetAddress(),
        age_years: buildingAge,
        floor_count: floorCount,
        maintenance_status: maintenanceStatus,
        last_inspection_date: faker.date.past(2),
        created_at: new Date()
      });
    }
    
    await this.insertWithRetry('buildings', buildings);
    console.log(`Generated ${buildings.length} buildings`);
    return buildings;
  }

  async generateContacts(buildings) {
    const contacts = [];
    const roles = ['manager', 'technician', 'security', 'supervisor', 'emergency'];
    
    buildings.forEach(building => {
      // Ensure at least one emergency contact
      contacts.push({
        contact_id: `${CONTACT_PREFIX}${faker.string.uuid()}`,
        building_id: building.building_id,
        full_name: faker.person.fullName(),
        role: 'emergency',
        phone: faker.phone.number('+9655#######'),
        email: faker.internet.email(),
        workshift: '24/7',
        is_primary_emergency: true,
        created_at: new Date()
      });
      
      // Regular contacts
      const regularContactCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < regularContactCount; i++) {
        contacts.push({
          contact_id: `${CONTACT_PREFIX}${faker.string.uuid()}`,
          building_id: building.building_id,
          full_name: faker.person.fullName(),
          role: roles[Math.floor(Math.random() * (roles.length - 1))],
          phone: faker.phone.number('+9655#######'),
          email: faker.internet.email(),
          workshift: Math.random() > 0.5 ? 'day' : 'night',
          created_at: new Date()
        });
      }
    });

    await this.insertWithRetry('contacts', contacts);
    console.log(`Generated ${contacts.length} contacts`);
    return contacts;
  }

  async generateSensors(buildings) {
    const sensors = [];
    
    buildings.forEach(building => {
      const sensorCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < sensorCount; i++) {
        const type = SENSOR_TYPES[Math.floor(Math.random() * SENSOR_TYPES.length)];
        
        let status;
        const rand = Math.random();
        let cumulativeWeight = 0;
        for (let j = 0; j < SENSOR_STATUSES.length; j++) {
          cumulativeWeight += STATUS_WEIGHTS[j];
          if (rand <= cumulativeWeight) {
            status = SENSOR_STATUSES[j];
            break;
          }
        }
        
        sensors.push({
          sensor_id: `${SENSOR_PREFIX}${faker.string.uuid()}`,
          building_id: building.building_id,
          type: type,
          unit: UNITS[type],
          installation_date: faker.date.past(2),
          warranty_years: 1 + Math.floor(Math.random() * 4),
          status: status,
          last_maintenance_date: status === 'maintenance' ? faker.date.recent(30) : null,
          created_at: new Date()
        });
      }
    });

    await this.insertWithRetry('sensors', sensors);
    console.log(`Generated ${sensors.length} sensors`);
    this.sensors = sensors;
    return sensors;
  }

  async checkHistoricalDataExists() {
    try {
      const count = await r.table('readings').count().run(this.conn);
      return count > 0;
    } catch (err) {
      return false;
    }
  }

  async generateHistoricalReadings() {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const batchSize = 1000; // Reduced batch size
    let totalGenerated = 0;

    for (const sensor of this.sensors) {
      let currentDate = new Date(twoYearsAgo);
      let batch = [];

      while (currentDate <= now) {
        batch.push(this.createReading(sensor, currentDate));
        
        if (batch.length >= batchSize) {
          await this.insertWithRetry('readings', batch);
          totalGenerated += batch.length;
          console.log(`Inserted ${totalGenerated} historical readings...`);
          batch = [];
        }

        currentDate = new Date(currentDate.getTime() + 86400000);
      }

      if (batch.length > 0) {
        await this.insertWithRetry('readings', batch);
        totalGenerated += batch.length;
      }
    }

    console.log(`Total historical readings generated: ${totalGenerated}`);
    return totalGenerated;
  }

  createReading(sensor, timestamp) {
    const value = this.generateSensorValue(sensor.type, timestamp);
    return {
      reading_id: `${READING_PREFIX}${faker.string.uuid()}`,
      sensor_id: sensor.sensor_id,
      building_id: sensor.building_id,
      value: ['fire_alarm', 'water_leak'].includes(sensor.type) ? value : parseFloat(value.toFixed(2)),
      unit: sensor.unit,
      timestamp: timestamp,
      created_at: new Date()
    };
  }

  generateSensorValue(type, timestamp) {
    const hour = timestamp.getHours();
    const month = timestamp.getMonth();
    
    switch(type) {
      case 'temperature':
        return 20 + 5 * Math.sin(hour * Math.PI / 12) + 10 * Math.sin((month - 3) * Math.PI / 6) + 2 * Math.random();
      case 'humidity':
        return 50 + 10 * Math.sin((hour - 6) * Math.PI / 12) + 10 * Math.sin((month - 6) * Math.PI / 6) + 3 * Math.random();
      case 'fire_alarm':
        return Math.random() > 0.995;
      case 'co2':
        return 400 + 100 * Math.sin(hour * Math.PI / 12) + 50 * Math.random();
      case 'pressure':
        return 100 + 2 * Math.sin(hour * Math.PI / 12) + 3 * Math.random();
      case 'water_leak':
        return Math.random() > 0.997;
      default:
        return 0;
    }
  }

  async generateHourlyReadings() {
    const now = new Date();
    const readings = this.sensors.map(sensor => 
      this.createReading(sensor, now)
    );
    
    await this.insertWithRetry('readings', readings);
    console.log(`Generated ${readings.length} hourly readings at ${now.toISOString()}`);
    return readings;
  }

  startContinuousGeneration() {
    console.log('Starting continuous hourly generation...');
    this.generateHourlyReadings().catch(console.error);
    this.generationInterval = setInterval(
      () => this.generateHourlyReadings().catch(console.error),
      3600000
    );
  }

  stopContinuousGeneration() {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      this.generationInterval = null;
      console.log('Stopped continuous generation');
    }
  }

  async initialize(regenerate = false) {
    try {
      await this.setupDatabase();
      
      const hasData = await this.checkHistoricalDataExists();
      
      if (!hasData || regenerate) {
        console.log(regenerate ? 'Regenerating all data...' : 'Generating initial data...');
        const buildings = await this.generateBuildings();
        const contacts = await this.generateContacts(buildings);
        const sensors = await this.generateSensors(buildings);
        await this.generateHistoricalReadings();
      } else {
        console.log('Loading existing sensors...');
        this.sensors = await r.table('sensors').run(this.conn);
        this.sensors = await this.sensors.toArray();
      }
      
      this.startContinuousGeneration();
      console.log('✅ Data generation is running');
      
    } catch (err) {
      console.error('❌ Initialization failed:', err);
      await this.disconnect();
      throw err;
    }
  }

  async disconnect() {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    this.stopContinuousGeneration();
  }
}

// Command line interface
if (require.main === module) {
  const generator = new DataGenerator();
  const regenerate = process.argv.includes('--regenerate');
  
  generator.initialize(regenerate).catch(() => process.exit(1));
  
  process.on('SIGINT', async () => {
    await generator.disconnect();
    process.exit();
  });
}

module.exports = DataGenerator;