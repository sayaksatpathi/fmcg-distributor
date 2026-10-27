const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const SKU = require('../models/SKU');
const Retailer = require('../models/Retailer');
const Return = require('../models/Return');
const PurchaseOrder = require('../models/PurchaseOrder');

// GET /api/profit/summary?from=&to=
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = { status: { $ne: 'cancelled' } };
    if (from || to) {
      match.saleDate = {};
      if (from) match.saleDate.$gte = new Date(from);
      if (to) match.saleDate.$lte = new Date(to);
    }
    const sales = await Sale.find(match).populate('items.sku', 'purchasePrice');
    let revenue = 0, cogs = 0;
    for (const sale of sales) {
      revenue += sale.total;
      for (const item of sale.items) {
        const purchasePrice = item.sku?.purchasePrice ?? 0;
        cogs += purchasePrice * item.quantity;
      }
    }
    const grossProfit = revenue - cogs;
    const margin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(2) : 0;
    res.json({ revenue, cogs, grossProfit, margin: Number(margin) });
  } catch (err) { next(err); }
});

// GET /api/profit/by-retailer?from=&to=
// Monthly profit per retailer (revenue - COGS). Defaults to the current month.
router.get('/by-retailer', async (req, res, next) => {
  try {
    let { from, to } = req.query;
    if (!from && !to) {
      const now = new Date();
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = now;
    }
    const match = { status: { $ne: 'cancelled' } };
    if (from || to) {
      match.saleDate = {};
      if (from) match.saleDate.$gte = new Date(from);
      if (to) match.saleDate.$lte = new Date(to);
    }

    const sales = await Sale.find(match)
      .populate('items.sku', 'purchasePrice')
      .select('retailer retailerName items total');

    const byRetailer = new Map();
    for (const sale of sales) {
      const key = String(sale.retailer);
      const agg = byRetailer.get(key) || {
        retailerId: key,
        name: sale.retailerName || null,
        revenue: 0,
        cogs: 0,
      };
      agg.revenue += sale.total || 0;
      for (const item of sale.items) {
        const purchasePrice = item.sku?.purchasePrice ?? 0;
        agg.cogs += purchasePrice * item.quantity;
      }
      byRetailer.set(key, agg);
    }

    const result = Array.from(byRetailer.values()).map((r) => ({
      ...r,
      profit: r.revenue - r.cogs,
    }));
    result.sort((a, b) => b.profit - a.profit);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/profit/by-sku
router.get('/by-sku', async (req, res, next) => {
  try {
    const items = await Sale.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          name: { $first: '$items.skuName' },
          revenue: { $sum: '$items.total' },
          qty: { $sum: '$items.quantity' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 20 }
    ]);
    res.json(items);
  } catch (err) { next(err); }
});

module.exports = router;
