const express = require('express');
const router = express.Router();
const Retailer = require('../models/Retailer');

// GET /api/retailers
router.get('/', async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { area: { $regex: search, $options: 'i' } },
    ];
    const total = await Retailer.countDocuments(query);
    const retailers = await Retailer.find(query)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ retailers, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/retailers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const r = await Retailer.findById(req.params.id);
    if (!r) return res.status(404).json({ message: 'Retailer not found.' });
    res.json(r);
  } catch (err) { next(err); }
});

// POST /api/retailers
router.post('/', async (req, res, next) => {
  try {
    const r = await Retailer.create(req.body);
    res.status(201).json(r);
  } catch (err) { next(err); }
});

// PUT /api/retailers/:id
router.put('/:id', async (req, res, next) => {
  try {
    const r = await Retailer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!r) return res.status(404).json({ message: 'Retailer not found.' });
    res.json(r);
  } catch (err) { next(err); }
});

// DELETE /api/retailers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Retailer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Retailer deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
