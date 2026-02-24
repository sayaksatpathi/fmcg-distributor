const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');

router.get('/', async (req, res, next) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json(brands);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const b = await Brand.findById(req.params.id);
    if (!b) return res.status(404).json({ message: 'Brand not found.' });
    res.json(b);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = await Brand.create(req.body);
    res.status(201).json(b);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!b) return res.status(404).json({ message: 'Brand not found.' });
    res.json(b);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Brand.findByIdAndDelete(req.params.id);
    res.json({ message: 'Brand deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
