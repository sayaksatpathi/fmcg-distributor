const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const SKU = require('../models/SKU');
const Retailer = require('../models/Retailer');

router.get('/', async (req, res, next) => {
  try {
    const { retailer, status, from, to, page = 1, limit = 50 } = req.query;
    const query = {};
    if (retailer) query.retailer = retailer;
    if (status) query.status = status;
    if (from || to) {
      query.saleDate = {};
      if (from) query.saleDate.$gte = new Date(from);
      if (to) query.saleDate.$lte = new Date(to);
    }
    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('retailer', 'name phone')
      .sort({ saleDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ sales, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await Sale.findById(req.params.id)
      .populate('retailer', 'name phone address gstin')
      .populate('items.sku', 'name code unitSize');
    if (!s) return res.status(404).json({ message: 'Sale not found.' });
    res.json(s);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { retailer, items, discount = 0, tax = 0, paid = 0, paymentMode, saleDate, notes } = req.body;
    if (!retailer || !items?.length)
      return res.status(400).json({ message: 'Retailer and items are required.' });

    const retailerDoc = await Retailer.findById(retailer);
    if (!retailerDoc) return res.status(404).json({ message: 'Retailer not found.' });

    let subtotal = 0;
    const processedItems = [];
    for (const item of items) {
      const sku = await SKU.findById(item.sku);
      if (!sku) return res.status(404).json({ message: `SKU ${item.sku} not found.` });
      const price = item.price ?? sku.sellingPrice;
      const itemDiscount = item.discount ?? 0;
      const total = (price * item.quantity) - itemDiscount;
      subtotal += total;
      processedItems.push({ sku: sku._id, skuName: sku.name, quantity: item.quantity, price, discount: itemDiscount, total });
      // Deduct stock
      sku.stock = Math.max(0, sku.stock - item.quantity);
      await sku.save();
    }
    const totalAmount = subtotal - discount + tax;
    const balance = totalAmount - paid;

    const sale = await Sale.create({
      retailer, retailerName: retailerDoc.name, items: processedItems,
      subtotal, discount, tax, total: totalAmount, paid, balance,
      paymentMode: paymentMode || 'credit',
      status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending',
      saleDate: saleDate || new Date(), notes, createdBy: req.user?.id,
    });

    // Update outstanding balance on retailer
    retailerDoc.outstandingBalance = (retailerDoc.outstandingBalance || 0) + balance;
    await retailerDoc.save();

    res.status(201).json(sale);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { paid, status, notes } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found.' });
    if (paid !== undefined) {
      const extraPaid = paid - sale.paid;
      sale.paid = paid;
      sale.balance = sale.total - paid;
      sale.status = sale.balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
      // Update retailer outstanding
      const retailer = await Retailer.findById(sale.retailer);
      if (retailer) {
        retailer.outstandingBalance = Math.max(0, retailer.outstandingBalance - extraPaid);
        await retailer.save();
      }
    }
    if (status) sale.status = status;
    if (notes !== undefined) sale.notes = notes;
    await sale.save();
    res.json(sale);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sale deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
