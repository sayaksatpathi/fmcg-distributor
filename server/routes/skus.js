const express = require('express');
const router = express.Router();
const SKU = require('../models/SKU');

router.get('/', async (req, res, next) => {
  try {
    const { brand, search, lowStock } = req.query;
    const query = {};
    if (brand) query.brand = brand;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
    ];
    if (lowStock === 'true') query.$expr = { $lte: ['$stock', '$minStock'] };
    const skus = await SKU.find(query).populate('brand', 'name').sort({ name: 1 });
    res.json(skus);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await SKU.findById(req.params.id).populate('brand', 'name');
    if (!s) return res.status(404).json({ message: 'SKU not found.' });
    res.json(s);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const s = await SKU.create(req.body);
    res.status(201).json(s);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const s = await SKU.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!s) return res.status(404).json({ message: 'SKU not found.' });
    res.json(s);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await SKU.findByIdAndDelete(req.params.id);
    res.json({ message: 'SKU deleted.' });
  } catch (err) { next(err); }
});

// PATCH /api/skus/:id/stock — adjust stock
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { adjustment, type } = req.body; // type: 'add' | 'subtract' | 'set'
    const sku = await SKU.findById(req.params.id);
    if (!sku) return res.status(404).json({ message: 'SKU not found.' });
    if (type === 'set') sku.stock = adjustment;
    else if (type === 'subtract') sku.stock = Math.max(0, sku.stock - adjustment);
    else sku.stock += adjustment;
    await sku.save();
    res.json(sku);
  } catch (err) { next(err); }
});

module.exports = router;
