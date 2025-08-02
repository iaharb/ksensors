const express = require('express');
const router = express.Router();
const r = require('rethinkdb');

router.get('/', async (req, res) => {
  try {
    const conn = req.dbConn;
    const buildings = await r.table('buildings').run(conn);
    res.json(await buildings.toArray());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;