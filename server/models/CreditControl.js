const mongoose = require('mongoose');

const creditControlSchema = new mongoose.Schema({
  retailer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer', required: true },
  retailerName:{ type: String },
  creditLimit: { type: Number, default: 0 },
  outstanding: { type: Number, default: 0 },
  lastPayment: { type: Number, default: 0 },
  lastPaymentDate: { type: Date },
  status:      { type: String, enum: ['normal', 'warning', 'blocked'], default: 'normal' },
  notes:       { type: String },
}, { timestamps: true });

module.exports = mongoose.model('CreditControl', creditControlSchema);
