const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const SKU = require('../models/SKU');

router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = status ? { status } : {};
    const total = await PurchaseOrder.countDocuments(query);
    const orders = await PurchaseOrder.find(query).sort({ orderDate: -1 })
      .skip((page - 1) * limit).limit(Number(limit));
    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('items.sku', 'name code');
    if (!po) return res.status(404).json({ message: 'PO not found.' });
    res.json(po);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const po = await PurchaseOrder.create({ ...req.body, createdBy: req.user?.id });
    res.status(201).json(po);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!po) return res.status(404).json({ message: 'PO not found.' });
    res.json(po);
  } catch (err) { next(err); }
});

// POST /api/purchase-orders/:id/receive — mark received, update stock
router.post('/:id/receive', async (req, res, next) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ message: 'PO not found.' });
    for (const item of po.items) {
      if (item.sku) {
        await SKU.findByIdAndUpdate(item.sku, { $inc: { stock: item.quantity } });
      }
    }
    po.status = 'received';
    po.receivedDate = new Date();
    await po.save();
    res.json(po);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    res.json({ message: 'PO deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
