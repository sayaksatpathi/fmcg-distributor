const express = require('express');
const router = express.Router();
const ProductTest = require('../models/ProductTest');

router.get('/', async (req, res, next) => {
  try {
    const tests = await ProductTest.find().populate('sku', 'name code').sort({ testDate: -1 });
    res.json(tests);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const t = await ProductTest.findById(req.params.id).populate('sku', 'name code');
    if (!t) return res.status(404).json({ message: 'Test not found.' });
    res.json(t);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const t = await ProductTest.create({ ...req.body, createdBy: req.user?.id });
    res.status(201).json(t);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const t = await ProductTest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!t) return res.status(404).json({ message: 'Test not found.' });
    res.json(t);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await ProductTest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Test deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
