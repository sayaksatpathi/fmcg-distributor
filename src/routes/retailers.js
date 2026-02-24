const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity, validators) {
  const router = express.Router();

  // Get all retailers
  router.get('/', authenticate, (req, res, next) => {
    db.all(`
      SELECT r.*, 
             COALESCE(SUM(CASE WHEN s.date >= date('now', '-30 days') THEN s.gross_profit ELSE 0 END), 0) as monthly_profit
      FROM retailers r
      LEFT JOIN sales s ON r.id = s.retailer_id
      GROUP BY r.id
      ORDER BY r.name
    `, [], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get single retailer
  router.get('/:id', authenticate, validators.idParam, (req, res, next) => {
    const { id } = req.params;
    db.get('SELECT * FROM retailers WHERE id = ?', [id], (err, row) => {
      if (err) return next(err);
      if (!row) return res.status(404).json({ error: 'Retailer not found' });
      res.json(row);
    });
  });

  // Create retailer
  router.post('/', authenticate, requireRole('owner', 'accountant'), validators.retailer, (req, res, next) => {
    const { name, area, phone, credit_limit, credit_class } = req.body;
    
    db.run(
      'INSERT INTO retailers (name, area, phone, credit_limit, credit_class, outstanding_amount) VALUES (?, ?, ?, ?, ?, 0)',
      [name, area, phone, credit_limit, credit_class],
      function(err) {
        if (err) return next(err);
        logActivity(req.user.id, 'CREATE_RETAILER', { retailer_id: this.lastID, name });
        res.status(201).json({ id: this.lastID, success: true });
      }
    );
  });

  // Update retailer
  router.put('/:id', authenticate, requireRole('owner', 'accountant'), validators.idParam, validators.retailer, (req, res, next) => {
    const { id } = req.params;
    const { name, area, phone, credit_limit, credit_class, credit_frozen } = req.body;
    
    db.run(
      'UPDATE retailers SET name = ?, area = ?, phone = ?, credit_limit = ?, credit_class = ?, credit_frozen = ?, updated_at = ? WHERE id = ?',
      [name, area, phone, credit_limit, credit_class, credit_frozen || 0, new Date().toISOString(), id],
      function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Retailer not found' });
        logActivity(req.user.id, 'UPDATE_RETAILER', { retailer_id: id, changes: req.body });
        res.json({ success: true });
      }
    );
  });

  // Delete retailer
  router.delete('/:id', authenticate, requireRole('owner'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    
    // Check if retailer has any sales
    db.get('SELECT COUNT(*) as count FROM sales WHERE retailer_id = ?', [id], (err, row) => {
      if (err) return next(err);
      if (row.count > 0) {
        return res.status(400).json({ error: 'Cannot delete retailer with sales history' });
      }
      
      db.run('DELETE FROM retailers WHERE id = ?', [id], function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Retailer not found' });
        logActivity(req.user.id, 'DELETE_RETAILER', { retailer_id: id });
        res.json({ success: true });
      });
    });
  });

  return router;
};
