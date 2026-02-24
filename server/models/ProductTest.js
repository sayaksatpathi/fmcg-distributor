const mongoose = require('mongoose');

const productTestSchema = new mongoose.Schema({
  sku:        { type: mongoose.Schema.Types.ObjectId, ref: 'SKU', required: true },
  skuName:    { type: String },
  batchNumber:{ type: String },
  testDate:   { type: Date, default: Date.now },
  tester:     { type: String },
  parameters: [{ name: String, value: String, passed: Boolean }],
  result:     { type: String, enum: ['pass', 'fail', 'pending'], default: 'pending' },
  notes:      { type: String },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ProductTest', productTestSchema);
