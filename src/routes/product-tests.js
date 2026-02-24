const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity, validators) {
  const router = express.Router();

  // Get all product tests
  router.get('/', authenticate, requireRole('owner'), (req, res, next) => {
    db.all('SELECT * FROM product_tests ORDER BY created_at DESC', [], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get single product test
  router.get('/:id', authenticate, requireRole('owner'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    db.get('SELECT * FROM product_tests WHERE id = ?', [id], (err, row) => {
      if (err) return next(err);
      if (!row) return res.status(404).json({ error: 'Product test not found' });
      res.json(row);
    });
  });

  // Create product test
  router.post('/', authenticate, requireRole('owner'), validators.productTest, (req, res, next) => {
    const { product_name, batch_size, total_cost, selling_price, expected_margin } = req.body;
    const actualMargin = selling_price > 0 
      ? ((selling_price - total_cost / batch_size) / selling_price * 100).toFixed(2) 
      : 0;
    
    db.run(
      'INSERT INTO product_tests (product_name, batch_size, total_cost, selling_price, expected_margin, actual_margin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_name, batch_size, total_cost, selling_price, expected_margin, actualMargin, new Date().toISOString()],
      function(err) {
        if (err) return next(err);
        logActivity(req.user.id, 'CREATE_PRODUCT_TEST', { test_id: this.lastID, product_name });
        res.status(201).json({ id: this.lastID, success: true, actual_margin: actualMargin });
      }
    );
  });

  // Update product test performance
  router.put('/:id/performance', authenticate, requireRole('owner'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    const { sales_quantity, sales_revenue, recommendation } = req.body;
    
    // Validate recommendation
    if (recommendation && !['CONTINUE', 'KILL'].includes(recommendation)) {
      return res.status(400).json({ error: 'Recommendation must be CONTINUE or KILL' });
    }
    
    db.run(
      'UPDATE product_tests SET sales_quantity = ?, sales_revenue = ?, recommendation = ?, updated_at = ? WHERE id = ?',
      [
        parseFloat(sales_quantity) || 0, 
        parseFloat(sales_revenue) || 0, 
        recommendation || null, 
        new Date().toISOString(), 
        id
      ],
      function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Product test not found' });
        logActivity(req.user.id, 'UPDATE_PRODUCT_TEST', { test_id: id, recommendation });
        res.json({ success: true });
      }
    );
  });

  // Delete product test
  router.delete('/:id', authenticate, requireRole('owner'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    
    db.run('DELETE FROM product_tests WHERE id = ?', [id], function(err) {
      if (err) return next(err);
      if (this.changes === 0) return res.status(404).json({ error: 'Product test not found' });
      logActivity(req.user.id, 'DELETE_PRODUCT_TEST', { test_id: id });
      res.json({ success: true });
    });
  });

  return router;
};
