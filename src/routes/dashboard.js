const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity, validators) {
  const router = express.Router();

  // Get dashboard data
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      // Use Promise.all for parallel queries
      const [todayProfit, monthlyProfit, outstanding, capitalLocked, amulData, alerts] = await Promise.all([
        dbGet(db, `SELECT COALESCE(SUM(gross_profit), 0) as value FROM sales WHERE date = ?`, [today]),
        dbGet(db, `SELECT COALESCE(SUM(gross_profit), 0) as value FROM sales WHERE date >= ?`, [monthStart]),
        dbGet(db, `SELECT COALESCE(SUM(outstanding_amount), 0) as value FROM retailers`, []),
        dbGet(db, `SELECT COALESCE(SUM(s.purchase_price * s.stock_in_hand), 0) as value FROM skus s`, []),
        dbGet(db, `
          SELECT 
            COALESCE(SUM(CASE WHEN b.name LIKE '%Amul%' THEN s.purchase_price * s.stock_in_hand ELSE 0 END), 0) as amul_capital,
            COALESCE(SUM(s.purchase_price * s.stock_in_hand), 0) as total_capital
          FROM skus s
          JOIN brands b ON s.brand_id = b.id
        `, []),
        dbAll(db, `SELECT * FROM alerts WHERE status = 'active' ORDER BY severity DESC, created_at DESC LIMIT 10`, [])
      ]);

      const amulPercent = amulData.total_capital > 0 
        ? (amulData.amul_capital / amulData.total_capital * 100).toFixed(2)
        : 0;

      res.json({
        todayProfit: todayProfit.value || 0,
        monthlyProfit: monthlyProfit.value || 0,
        outstandingCredit: outstanding.value || 0,
        capitalLocked: capitalLocked.value || 0,
        amulCapitalPercent: parseFloat(amulPercent),
        alerts: alerts || []
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};

// Helper functions to promisify sqlite3
function dbGet(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || {});
    });
  });
}

function dbAll(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
