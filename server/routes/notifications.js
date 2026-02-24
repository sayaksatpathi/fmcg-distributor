const express  = require('express');
const router    = express.Router();
const SKU              = require('../models/SKU');
const Retailer         = require('../models/Retailer');
const PaymentReminder  = require('../models/PaymentReminder');
const Return           = require('../models/Return');
const Sale             = require('../models/Sale');

/**
 * GET /api/notifications
 * Aggregates live business alerts into a unified notification feed.
 * Each item: { id, type, severity, title, message, link, time }
 */
router.get('/', async (req, res, next) => {
  try {
    const now  = new Date();
    const items = [];

    // ── 1. Inventory alerts ────────────────────────────────────────────
    const lowStock = await SKU.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      active: true,
    }).populate('brand', 'name').sort({ stock: 1 }).limit(20);

    lowStock.forEach(s => {
      const isOut      = s.stock === 0;
      const isCritical = s.stock > 0 && s.stock <= s.minStock / 2;
      items.push({
        id:       `inv-${s._id}`,
        type:     'inventory',
        severity: isOut ? 'error' : isCritical ? 'warning' : 'info',
        title:    isOut ? 'Out of Stock' : isCritical ? 'Critical Stock' : 'Low Stock',
        message:  `${s.name} — ${s.stock} ${s.unit} remaining (min ${s.minStock})`,
        link:     '/inventory-alerts',
        time:     now.toISOString(),
      });
    });

    // ── 2. Retailers over credit limit ────────────────────────────────
    const overLimit = await Retailer.find({
      $expr: { $gt: ['$outstandingBalance', '$creditLimit'] },
      status: { $ne: 'inactive' },
    }).select('name outstandingBalance creditLimit').limit(10);

    overLimit.forEach(r => {
      const excess = (r.outstandingBalance - r.creditLimit).toFixed(2);
      items.push({
        id:       `credit-${r._id}`,
        type:     'credit',
        severity: 'error',
        title:    'Credit Limit Exceeded',
        message:  `${r.name} is ₹${excess} over their credit limit`,
        link:     '/credit-control',
        time:     now.toISOString(),
      });
    });

    // ── 3. Overdue payment reminders ──────────────────────────────────
    const overdue = await PaymentReminder.find({
      dueDate: { $lt: now },
      status:  { $nin: ['paid', 'cancelled'] },
    }).populate('retailer', 'name').sort({ dueDate: 1 }).limit(15);

    overdue.forEach(r => {
      const days = Math.floor((now - new Date(r.dueDate)) / 86400000);
      items.push({
        id:       `reminder-${r._id}`,
        type:     'payment',
        severity: days > 14 ? 'error' : 'warning',
        title:    'Overdue Payment',
        message:  `${r.retailer?.name || 'Retailer'} — ₹${r.amount} overdue by ${days}d`,
        link:     '/payment-reminders',
        time:     r.dueDate,
      });
    });

    // ── 4. Pending returns (last 7 days) ──────────────────────────────
    const since = new Date(now - 7 * 86400000);
    const pendingReturns = await Return.find({
      status:    'pending',
      createdAt: { $gte: since },
    }).populate('retailer', 'name').sort({ createdAt: -1 }).limit(10);

    pendingReturns.forEach(ret => {
      items.push({
        id:       `return-${ret._id}`,
        type:     'return',
        severity: 'info',
        title:    'Pending Return',
        message:  `${ret.retailer?.name || 'Retailer'} — ₹${ret.totalAmount} awaiting approval`,
        link:     '/returns',
        time:     ret.createdAt,
      });
    });

    // ── 5. Large unconfirmed sales (> ₹50k, last 24h) ────────────────
    const yesterday = new Date(now - 86400000);
    const bigSales = await Sale.find({
      saleDate: { $gte: yesterday },
      status:   { $ne: 'paid' },
      total:    { $gte: 50000 },
    }).populate('retailer', 'name').sort({ total: -1 }).limit(5);

    bigSales.forEach(sale => {
      items.push({
        id:       `sale-${sale._id}`,
        type:     'sale',
        severity: 'info',
        title:    'Large Unpaid Sale',
        message:  `${sale.retailer?.name || 'Retailer'} — ₹${sale.total.toLocaleString('en-IN')} unpaid`,
        link:     '/sales',
        time:     sale.saleDate,
      });
    });

    // Sort: errors first, then by time descending
    const severityOrder = { error: 0, warning: 1, info: 2 };
    items.sort((a, b) => {
      const sd = severityOrder[a.severity] - severityOrder[b.severity];
      if (sd !== 0) return sd;
      return new Date(b.time) - new Date(a.time);
    });

    res.json({
      notifications: items,
      counts: {
        total:   items.length,
        errors:  items.filter(i => i.severity === 'error').length,
        warnings:items.filter(i => i.severity === 'warning').length,
        infos:   items.filter(i => i.severity === 'info').length,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
