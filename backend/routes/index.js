// routes/index.js
const express = require('express');
const router = express.Router();
const buildings = require('./buildings');
const contacts = require('./contacts');
const readings = require('./readings');
const sensors = require('./sensors');

// Mount all routes
router.use('/buildings', buildings);
router.use('/contacts', contacts);
router.use('/readings', readings);
router.use('/sensors', sensors);

module.exports = router;