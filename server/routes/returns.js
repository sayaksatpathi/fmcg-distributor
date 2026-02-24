const express = require('express');
const router = express.Router();
const Return = require('../models/Return');

router.get('/', async (req, res, next) => {
  try {
    const { retailer, status } = req.query;
    const query = {};
    if (retailer) query.retailer = retailer;
    if (status) query.status = status;
    const returns = await Return.find(query)
      .populate('retailer', 'name phone')
      .sort({ returnDate: -1 });
    res.json(returns);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const r = await Return.findById(req.params.id).populate('retailer', 'name phone');
    if (!r) return res.status(404).json({ message: 'Return not found.' });
    res.json(r);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const r = await Return.create({ ...req.body, createdBy: req.user?.id });
    res.status(201).json(r);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const r = await Return.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ message: 'Return not found.' });
    res.json(r);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Return.findByIdAndDelete(req.params.id);
    res.json({ message: 'Return deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
