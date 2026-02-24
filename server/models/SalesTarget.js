const mongoose = require('mongoose');

const salesTargetSchema = new mongoose.Schema({
  month:    { type: Number, required: true, min: 1, max: 12 },
  year:     { type: Number, required: true },
  target:   { type: Number, required: true, min: 0 },
  achieved: { type: Number, default: 0 },
  retailer: { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer' },
  category: { type: String },
  notes:    { type: String },
}, { timestamps: true });

module.exports = mongoose.model('SalesTarget', salesTargetSchema);
