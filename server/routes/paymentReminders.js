const express = require('express');
const router = express.Router();
const PaymentReminder = require('../models/PaymentReminder');

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const reminders = await PaymentReminder.find(query)
      .populate('retailer', 'name phone')
      .sort({ dueDate: 1 });
    res.json(reminders);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const r = await PaymentReminder.create(req.body);
    res.status(201).json(r);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const r = await PaymentReminder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ message: 'Reminder not found.' });
    res.json(r);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await PaymentReminder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reminder deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
