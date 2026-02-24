const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Retailer = require('../models/Retailer');
const SKU = require('../models/SKU');

// GET /api/reports/sales?from=&to=&retailer=&format=json
router.get('/sales', async (req, res, next) => {
  try {
    const { from, to, retailer } = req.query;
    const match = { status: { $ne: 'cancelled' } };
    if (retailer) match.retailer = retailer;
    if (from || to) {
      match.saleDate = {};
      if (from) match.saleDate.$gte = new Date(from);
      if (to) match.saleDate.$lte = new Date(to);
    }
    const sales = await Sale.find(match)
      .populate('retailer', 'name phone area')
      .populate('items.sku', 'name code')
      .sort({ saleDate: -1 })
      .limit(1000);
    res.json(sales);
  } catch (err) { next(err); }
});

// GET /api/reports/retailer-wise
router.get('/retailer-wise', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = { status: { $ne: 'cancelled' } };
    if (from || to) {
      match.saleDate = {};
      if (from) match.saleDate.$gte = new Date(from);
      if (to) match.saleDate.$lte = new Date(to);
    }
    const report = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$retailer',
          name: { $first: '$retailerName' },
          totalSales: { $sum: '$total' },
          totalPaid: { $sum: '$paid' },
          totalBalance: { $sum: '$balance' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalSales: -1 } }
    ]);
    res.json(report);
  } catch (err) { next(err); }
});

// GET /api/reports/product-wise
router.get('/product-wise', async (req, res, next) => {
  try {
    const report = await Sale.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          name: { $first: '$items.skuName' },
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 100 }
    ]);
    res.json(report);
  } catch (err) { next(err); }
});

module.exports = router;
