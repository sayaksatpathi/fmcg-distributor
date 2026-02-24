const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity) {
  const router = express.Router();

  // Get weekly review data (Owner only)
  router.get('/', authenticate, requireRole('owner'), (req, res, next) => {
    // Get all data in parallel using callbacks
    const result = {
      riskyRetailers: [],
      deadSkus: [],
      expandBrands: [],
      creditSummary: {}
    };
    let completed = 0;
    let hasError = false;
    
    const checkComplete = () => {
      completed++;
      if (completed === 4 && !hasError) {
        res.json(result);
      }
    };
    
    // Retailers to STOP/WARN
    db.all(`
      SELECT * FROM retailers 
      WHERE days_outstanding > 30 OR outstanding_amount > credit_limit
      ORDER BY days_outstanding DESC
      LIMIT 20
    `, [], (err, rows) => {
      if (err && !hasError) {
        hasError = true;
        return next(err);
      }
      result.riskyRetailers = rows || [];
      checkComplete();
    });
    
    // SKUs to REMOVE (DEAD status)
    db.all(`
      SELECT s.*, b.name as brand_name
      FROM skus s
      JOIN brands b ON s.brand_id = b.id
      WHERE s.status = 'DEAD'
      ORDER BY s.stock_in_hand DESC
    `, [], (err, rows) => {
      if (err && !hasError) {
        hasError = true;
        return next(err);
      }
      result.deadSkus = rows || [];
      checkComplete();
    });
    
    // Brands to EXPAND (high ROI, low capital)
    db.all(`
      SELECT b.*,
             COALESCE(SUM(s.gross_profit), 0) as monthly_profit,
             COALESCE(SUM(sk.purchase_price * sk.stock_in_hand), 0) as capital_invested
      FROM brands b
      LEFT JOIN skus sk ON b.id = sk.brand_id
      LEFT JOIN sales s ON sk.id = s.sku_id AND DATE(s.date) >= date('now', '-30 days')
      GROUP BY b.id
      HAVING monthly_profit > 0 AND capital_invested > 0
      ORDER BY (monthly_profit / capital_invested) DESC
      LIMIT 10
    `, [], (err, rows) => {
      if (err && !hasError) {
        hasError = true;
        return next(err);
      }
      result.expandBrands = rows || [];
      checkComplete();
    });
    
    // Credit risk summary
    db.get(`
      SELECT 
        COUNT(*) as total_retailers,
        SUM(CASE WHEN outstanding_amount > 0 THEN 1 ELSE 0 END) as retailers_with_credit,
        SUM(CASE WHEN days_outstanding > 30 THEN 1 ELSE 0 END) as overdue_retailers,
        SUM(outstanding_amount) as total_outstanding,
        SUM(CASE WHEN days_outstanding > 30 THEN outstanding_amount ELSE 0 END) as overdue_amount
      FROM retailers
    `, [], (err, row) => {
      if (err && !hasError) {
        hasError = true;
        return next(err);
      }
      result.creditSummary = row || {};
      checkComplete();
    });
  });

  // Get action items
  router.get('/actions', authenticate, requireRole('owner'), (req, res, next) => {
    db.all(`
      SELECT * FROM alerts 
      WHERE status = 'active'
      ORDER BY 
        CASE severity WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END,
        created_at DESC
    `, [], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Resolve alert
  router.patch('/alerts/:id/resolve', authenticate, requireRole('owner'), (req, res, next) => {
    const { id } = req.params;
    
    db.run(
      "UPDATE alerts SET status = 'resolved' WHERE id = ?",
      [id],
      function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Alert not found' });
        logActivity(req.user.id, 'RESOLVE_ALERT', { alert_id: id });
        res.json({ success: true });
      }
    );
  });

  return router;
};
