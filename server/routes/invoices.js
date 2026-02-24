const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');

// GET /api/invoices — list invoices (alias for sales)
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const total = await Sale.countDocuments();
    const invoices = await Sale.find()
      .populate('retailer', 'name phone address gstin')
      .sort({ saleDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ invoices, total });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res, next) => {
  try {
    const inv = await Sale.findById(req.params.id)
      .populate('retailer', 'name phone address gstin')
      .populate('items.sku', 'name code unitSize mrp');
    if (!inv) return res.status(404).json({ message: 'Invoice not found.' });
    res.json(inv);
  } catch (err) { next(err); }
});

module.exports = router;
