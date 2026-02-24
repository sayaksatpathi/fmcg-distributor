const express = require('express');
const router = express.Router();
const SKU = require('../models/SKU');

// GET /api/inventory-alerts
router.get('/', async (req, res, next) => {
  try {
    const lowStock = await SKU.find({ $expr: { $lte: ['$stock', '$minStock'] }, active: true })
      .populate('brand', 'name')
      .sort({ stock: 1 });
    const outOfStock = lowStock.filter(s => s.stock === 0);
    const critical = lowStock.filter(s => s.stock > 0 && s.stock <= s.minStock / 2);
    const warning = lowStock.filter(s => s.stock > s.minStock / 2 && s.stock <= s.minStock);
    res.json({ lowStock, outOfStock, critical, warning, total: lowStock.length });
  } catch (err) { next(err); }
});

module.exports = router;
