const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  sku:      { type: mongoose.Schema.Types.ObjectId, ref: 'SKU' },
  skuName:  { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price:    { type: Number, required: true },
  total:    { type: Number, required: true },
  reason:   { type: String },
});

const returnSchema = new mongoose.Schema({
  returnNumber: { type: String, unique: true },
  retailer:   { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer', required: true },
  retailerName: { type: String },
  sale:       { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  items:      [returnItemSchema],
  totalAmount:{ type: Number, required: true },
  type:       { type: String, enum: ['damage', 'expiry', 'quality', 'wrong_item', 'other'], default: 'other' },
  status:     { type: String, enum: ['pending', 'approved', 'rejected', 'processed'], default: 'pending' },
  returnDate: { type: Date, default: Date.now },
  notes:      { type: String },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

returnSchema.pre('save', async function (next) {
  if (!this.returnNumber) {
    const count = await mongoose.model('Return').countDocuments();
    this.returnNumber = `RET-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Return', returnSchema);
