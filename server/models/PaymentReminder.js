const mongoose = require('mongoose');

const paymentReminderSchema = new mongoose.Schema({
  retailer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer', required: true },
  retailerName:{ type: String },
  amount:      { type: Number, required: true },
  dueDate:     { type: Date, required: true },
  status:      { type: String, enum: ['pending', 'sent', 'paid', 'overdue'], default: 'pending' },
  notes:       { type: String },
  sale:        { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  sentAt:      { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('PaymentReminder', paymentReminderSchema);
