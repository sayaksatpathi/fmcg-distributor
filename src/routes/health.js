const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // Basic health check
  router.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Detailed health check
  router.get('/detailed', (req, res, next) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: { status: 'unknown' }
      }
    };

    // Check database connection
    db.get('SELECT 1 as test', [], (err, row) => {
      if (err) {
        health.status = 'degraded';
        health.checks.database = { 
          status: 'error', 
          message: err.message 
        };
      } else {
        health.checks.database = { status: 'ok' };
      }

      // Get database stats
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM retailers) as retailers,
          (SELECT COUNT(*) FROM brands) as brands,
          (SELECT COUNT(*) FROM skus) as skus,
          (SELECT COUNT(*) FROM sales) as sales
      `, [], (err, stats) => {
        if (!err && stats) {
          health.checks.database.stats = stats;
        }
        
        res.status(health.status === 'ok' ? 200 : 503).json(health);
      });
    });
  });

  // Readiness check (for container orchestration)
  router.get('/ready', (req, res) => {
    db.get('SELECT 1 as test', [], (err, row) => {
      if (err) {
        res.status(503).json({ ready: false, error: 'Database not ready' });
      } else {
        res.json({ ready: true });
      }
    });
  });

  // Liveness check (for container orchestration)
  router.get('/live', (req, res) => {
    res.json({ alive: true });
  });

  return router;
};
