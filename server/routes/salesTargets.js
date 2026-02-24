const express = require('express');
const router = express.Router();
const SalesTarget = require('../models/SalesTarget');
const Sale = require('../models/Sale');

router.get('/', async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const query = {};
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    const targets = await SalesTarget.find(query).populate('retailer', 'name');
    res.json(targets);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const t = await SalesTarget.create(req.body);
    res.status(201).json(t);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const t = await SalesTarget.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!t) return res.status(404).json({ message: 'Target not found.' });
    res.json(t);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await SalesTarget.findByIdAndDelete(req.params.id);
    res.json({ message: 'Target deleted.' });
  } catch (err) { next(err); }
});

// GET /api/sales-targets/progress/:month/:year — compare with actual sales
router.get('/progress/:month/:year', async (req, res, next) => {
  try {
    const { month, year } = req.params;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const [targets, salesAgg] = await Promise.all([
      SalesTarget.find({ month: Number(month), year: Number(year) }),
      Sale.aggregate([
        { $match: { saleDate: { $gte: startDate, $lte: endDate }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);
    const achieved = salesAgg[0]?.total || 0;
    res.json({ targets, achieved });
  } catch (err) { next(err); }
});

module.exports = router;
