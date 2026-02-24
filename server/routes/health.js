const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// GET /api/health
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    version: '6.0.0',
  });
});

module.exports = router;
