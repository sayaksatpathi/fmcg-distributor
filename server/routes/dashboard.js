const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const SKU = require('../models/SKU');
const Retailer = require('../models/Retailer');
const Return = require('../models/Return');

// GET /api/dashboard/summary
router.get('/summary', async (req, res, next) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    const [
      totalRetailers,
      totalSalesToday, totalSalesMonth,
      pendingPayments,
      lowStockCount,
      pendingReturns,
      monthlySalesChart,
    ] = await Promise.all([
      Retailer.countDocuments({ status: 'active' }),
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfDay }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Retailer.aggregate([
        { $match: { outstandingBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$outstandingBalance' }, count: { $sum: 1 } } }
      ]),
      SKU.countDocuments({ $expr: { $lte: ['$stock', '$minStock'] } }),
      Return.countDocuments({ status: 'pending' }),
      Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: new Date(today.getFullYear(), today.getMonth() - 5, 1) },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: { year: { $year: '$saleDate' }, month: { $month: '$saleDate' } },
            total: { $sum: '$total' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
    ]);

    res.json({
      totalRetailers,
      salesToday: totalSalesToday[0] || { total: 0, count: 0 },
      salesMonth: totalSalesMonth[0] || { total: 0, count: 0 },
      pendingPayments: pendingPayments[0] || { total: 0, count: 0 },
      lowStockCount,
      pendingReturns,
      monthlySalesChart,
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/top-retailers
router.get('/top-retailers', async (req, res, next) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const top = await Sale.aggregate([
      { $match: { saleDate: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$retailer', name: { $first: '$retailerName' }, total: { $sum: '$total' } } },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);
    res.json(top);
  } catch (err) { next(err); }
});

// GET /api/dashboard/recent-activity
router.get('/recent-activity', async (req, res, next) => {
  try {
    const recentSales = await Sale.find()
      .populate('retailer', 'name')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('invoiceNumber retailerName total status createdAt');
    res.json(recentSales);
  } catch (err) { next(err); }
});

module.exports = router;
