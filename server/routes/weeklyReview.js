const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Retailer = require('../models/Retailer');

// GET /api/weekly-review?week=&year=
router.get('/', async (req, res, next) => {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [weeklySales, dailyBreakdown] = await Promise.all([
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfWeek, $lte: endOfWeek }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
      ]),
      Sale.aggregate([
        { $match: { saleDate: { $gte: startOfWeek, $lte: endOfWeek }, status: { $ne: 'cancelled' } } },
        {
          $group: {
            _id: { $dayOfWeek: '$saleDate' },
            total: { $sum: '$total' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      summary: weeklySales[0] || { total: 0, count: 0 },
      dailyBreakdown,
    });
  } catch (err) { next(err); }
});

module.exports = router;
