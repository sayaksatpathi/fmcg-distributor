const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity) {
  const router = express.Router();

  // Get profit by brand
  router.get('/by-brand', authenticate, (req, res, next) => {
    const { start_date, end_date } = req.query;
    const monthStart = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = end_date || new Date().toISOString().split('T')[0];
    
    db.all(`
      SELECT b.id, b.name, 
             COALESCE(SUM(s.gross_profit), 0) as profit,
             COALESCE(SUM((sk.purchase_price * s.quantity)), 0) as capital_invested,
             CASE 
               WHEN COALESCE(SUM((sk.purchase_price * s.quantity)), 0) > 0 
               THEN (COALESCE(SUM(s.gross_profit), 0) / COALESCE(SUM((sk.purchase_price * s.quantity)), 0) * 100)
               ELSE 0
             END as roi
      FROM brands b
      LEFT JOIN skus sk ON b.id = sk.brand_id
      LEFT JOIN sales s ON sk.id = s.sku_id AND s.date >= ? AND s.date <= ?
      GROUP BY b.id, b.name
      ORDER BY profit DESC
    `, [monthStart, monthEnd], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get profit by retailer
  router.get('/by-retailer', authenticate, (req, res, next) => {
    const { start_date, end_date } = req.query;
    const monthStart = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = end_date || new Date().toISOString().split('T')[0];
    
    db.all(`
      SELECT r.id, r.name, r.area,
             COALESCE(SUM(s.gross_profit), 0) as profit,
             COUNT(DISTINCT s.id) as transaction_count
      FROM retailers r
      LEFT JOIN sales s ON r.id = s.retailer_id AND s.date >= ? AND s.date <= ?
      GROUP BY r.id, r.name, r.area
      ORDER BY profit DESC
    `, [monthStart, monthEnd], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get profit by SKU
  router.get('/by-sku', authenticate, (req, res, next) => {
    const { start_date, end_date } = req.query;
    const monthStart = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = end_date || new Date().toISOString().split('T')[0];
    
    db.all(`
      SELECT sk.id, sk.name, b.name as brand_name, sk.margin_percent,
             COALESCE(SUM(s.gross_profit), 0) as profit,
             COALESCE(SUM(s.quantity), 0) as quantity_sold
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      LEFT JOIN sales s ON sk.id = s.sku_id AND s.date >= ? AND s.date <= ?
      GROUP BY sk.id, sk.name, b.name, sk.margin_percent
      ORDER BY profit DESC
    `, [monthStart, monthEnd], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get daily profit trend
  router.get('/daily-trend', authenticate, (req, res, next) => {
    const { days } = req.query;
    const numDays = parseInt(days) || 30;
    
    db.all(`
      SELECT DATE(date) as sale_date,
             COALESCE(SUM(gross_profit), 0) as profit,
             COUNT(*) as transactions
      FROM sales
      WHERE DATE(date) >= date('now', '-${numDays} days')
      GROUP BY DATE(date)
      ORDER BY sale_date ASC
    `, [], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get profit summary
  router.get('/summary', authenticate, (req, res, next) => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    
    db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN DATE(date) = ? THEN gross_profit ELSE 0 END), 0) as today_profit,
        COALESCE(SUM(CASE WHEN DATE(date) >= ? THEN gross_profit ELSE 0 END), 0) as month_profit,
        COALESCE(SUM(CASE WHEN DATE(date) >= ? THEN gross_profit ELSE 0 END), 0) as year_profit,
        COUNT(CASE WHEN DATE(date) = ? THEN 1 END) as today_transactions,
        COUNT(CASE WHEN DATE(date) >= ? THEN 1 END) as month_transactions
      FROM sales
    `, [today, monthStart, yearStart, today, monthStart], (err, row) => {
      if (err) return next(err);
      res.json(row);
    });
  });

  return router;
};
