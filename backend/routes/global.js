const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/global/stats', async (req, res) => {
  try {
    const pops = await db.getAllRegionsPopulation();
    const totalPop = Object.values(pops).reduce((a, b) => a + b, 0);
    res.json({
      totalPopulation: totalPop,
      regionPopulations: pops
    });
  } catch (err) { console.error('[SYS] /global/stats error:', err); res.status(500).json({ error: 'Internal error' }); }
});

module.exports = router;
