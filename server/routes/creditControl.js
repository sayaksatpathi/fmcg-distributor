const express = require('express');
const router = express.Router();
const Retailer = require('../models/Retailer');
const Sale = require('../models/Sale');

// GET /api/credit-control — all retailers with credit info
router.get('/', async (req, res, next) => {
  try {
    const retailers = await Retailer.find({ status: { $ne: 'inactive' } })
      .select('name phone creditLimit outstandingBalance status area')
      .sort({ outstandingBalance: -1 });
    res.json(retailers);
  } catch (err) { next(err); }
});

// POST /api/credit-control/:retailerId/payment — record a payment
router.post('/:retailerId/payment', async (req, res, next) => {
  try {
    const { amount, notes } = req.body;
    const retailer = await Retailer.findById(req.params.retailerId);
    if (!retailer) return res.status(404).json({ message: 'Retailer not found.' });
    retailer.outstandingBalance = Math.max(0, retailer.outstandingBalance - amount);
    await retailer.save();
    res.json({ message: 'Payment recorded.', outstanding: retailer.outstandingBalance });
  } catch (err) { next(err); }
});

// PUT /api/credit-control/:retailerId/limit — update credit limit
router.put('/:retailerId/limit', async (req, res, next) => {
  try {
    const { creditLimit } = req.body;
    const retailer = await Retailer.findByIdAndUpdate(
      req.params.retailerId, { creditLimit }, { new: true }
    );
    if (!retailer) return res.status(404).json({ message: 'Retailer not found.' });
    res.json(retailer);
  } catch (err) { next(err); }
});

module.exports = router;
