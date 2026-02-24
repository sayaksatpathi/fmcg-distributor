const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity, validators) {
  const router = express.Router();

  // Get all SKUs
  router.get('/', authenticate, (req, res, next) => {
    db.all(`
      SELECT s.*, b.name as brand_name, b.margin_slab
      FROM skus s
      JOIN brands b ON s.brand_id = b.id
      ORDER BY b.name, s.name
    `, [], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get single SKU
  router.get('/:id', authenticate, validators.idParam, (req, res, next) => {
    const { id } = req.params;
    db.get(`
      SELECT s.*, b.name as brand_name, b.margin_slab
      FROM skus s
      JOIN brands b ON s.brand_id = b.id
      WHERE s.id = ?
    `, [id], (err, row) => {
      if (err) return next(err);
      if (!row) return res.status(404).json({ error: 'SKU not found' });
      res.json(row);
    });
  });

  // Create SKU
  router.post('/', authenticate, requireRole('owner', 'accountant'), validators.sku, (req, res, next) => {
    const { name, brand_id, purchase_price, selling_price, stock_in_hand } = req.body;
    const margin = selling_price > 0 ? ((selling_price - purchase_price) / selling_price * 100).toFixed(2) : 0;
    
    // Verify brand exists
    db.get('SELECT id FROM brands WHERE id = ?', [brand_id], (err, brand) => {
      if (err) return next(err);
      if (!brand) return res.status(400).json({ error: 'Brand not found' });
      
      db.run(
        'INSERT INTO skus (name, brand_id, purchase_price, selling_price, margin_percent, stock_in_hand, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, brand_id, purchase_price, selling_price, margin, stock_in_hand, 'SLOW'],
        function(err) {
          if (err) return next(err);
          logActivity(req.user.id, 'CREATE_SKU', { sku_id: this.lastID, name });
          res.status(201).json({ id: this.lastID, success: true });
        }
      );
    });
  });

  // Update SKU
  router.put('/:id', authenticate, requireRole('owner', 'accountant'), validators.idParam, validators.sku, (req, res, next) => {
    const { id } = req.params;
    const { name, purchase_price, selling_price, stock_in_hand } = req.body;
    const margin = selling_price > 0 ? ((selling_price - purchase_price) / selling_price * 100).toFixed(2) : 0;
    
    db.run(
      'UPDATE skus SET name = ?, purchase_price = ?, selling_price = ?, margin_percent = ?, stock_in_hand = ? WHERE id = ?',
      [name, purchase_price, selling_price, margin, stock_in_hand, id],
      function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'SKU not found' });
        logActivity(req.user.id, 'UPDATE_SKU', { sku_id: id });
        res.json({ success: true });
      }
    );
  });

  // Update SKU stock
  router.patch('/:id/stock', authenticate, requireRole('owner', 'accountant'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    const { quantity, transaction_type } = req.body;
    
    if (!quantity || isNaN(quantity)) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }
    
    if (!['PURCHASE', 'ADJUSTMENT'].includes(transaction_type)) {
      return res.status(400).json({ error: 'Transaction type must be PURCHASE or ADJUSTMENT' });
    }
    
    const adjustedQty = parseFloat(quantity);
    
    db.run(
      'UPDATE skus SET stock_in_hand = stock_in_hand + ? WHERE id = ?',
      [adjustedQty, id],
      function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'SKU not found' });
        
        // Log stock transaction
        db.run(
          'INSERT INTO stock_transactions (sku_id, quantity, transaction_type, timestamp) VALUES (?, ?, ?, ?)',
          [id, adjustedQty, transaction_type, new Date().toISOString()]
        );
        
        logActivity(req.user.id, 'UPDATE_SKU_STOCK', { sku_id: id, quantity: adjustedQty, type: transaction_type });
        res.json({ success: true });
      }
    );
  });

  // Delete SKU
  router.delete('/:id', authenticate, requireRole('owner'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    
    // Check if SKU has any sales
    db.get('SELECT COUNT(*) as count FROM sales WHERE sku_id = ?', [id], (err, row) => {
      if (err) return next(err);
      if (row.count > 0) {
        return res.status(400).json({ error: 'Cannot delete SKU with sales history' });
      }
      
      db.run('DELETE FROM skus WHERE id = ?', [id], function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'SKU not found' });
        logActivity(req.user.id, 'DELETE_SKU', { sku_id: id });
        res.json({ success: true });
      });
    });
  });

  return router;
};
