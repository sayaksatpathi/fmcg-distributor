const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity, validators) {
  const router = express.Router();

  // Get all brands
  router.get('/', authenticate, (req, res, next) => {
    db.all('SELECT * FROM brands ORDER BY name', [], (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Get single brand
  router.get('/:id', authenticate, validators.idParam, (req, res, next) => {
    const { id } = req.params;
    db.get('SELECT * FROM brands WHERE id = ?', [id], (err, row) => {
      if (err) return next(err);
      if (!row) return res.status(404).json({ error: 'Brand not found' });
      res.json(row);
    });
  });

  // Create brand
  router.post('/', authenticate, requireRole('owner', 'accountant'), validators.brand, (req, res, next) => {
    const { name, margin_slab } = req.body;
    db.run('INSERT INTO brands (name, margin_slab) VALUES (?, ?)', [name, margin_slab], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Brand name already exists' });
        }
        return next(err);
      }
      logActivity(req.user.id, 'CREATE_BRAND', { brand_id: this.lastID, name });
      res.status(201).json({ id: this.lastID, success: true });
    });
  });

  // Update brand
  router.put('/:id', authenticate, requireRole('owner', 'accountant'), validators.idParam, validators.brand, (req, res, next) => {
    const { id } = req.params;
    const { name, margin_slab } = req.body;
    
    db.run('UPDATE brands SET name = ?, margin_slab = ? WHERE id = ?', [name, margin_slab, id], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Brand name already exists' });
        }
        return next(err);
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Brand not found' });
      logActivity(req.user.id, 'UPDATE_BRAND', { brand_id: id });
      res.json({ success: true });
    });
  });

  // Delete brand
  router.delete('/:id', authenticate, requireRole('owner'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    
    // Check if brand has any SKUs
    db.get('SELECT COUNT(*) as count FROM skus WHERE brand_id = ?', [id], (err, row) => {
      if (err) return next(err);
      if (row.count > 0) {
        return res.status(400).json({ error: 'Cannot delete brand with associated SKUs' });
      }
      
      db.run('DELETE FROM brands WHERE id = ?', [id], function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Brand not found' });
        logActivity(req.user.id, 'DELETE_BRAND', { brand_id: id });
        res.json({ success: true });
      });
    });
  });

  return router;
};
