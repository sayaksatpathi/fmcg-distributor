const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  sku:      { type: mongoose.Schema.Types.ObjectId, ref: 'SKU', required: true },
  skuName:  { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price:    { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0 },
  total:    { type: Number, required: true },
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  retailer:      { type: mongoose.Schema.Types.ObjectId, ref: 'Retailer', required: true },
  retailerName:  { type: String },
  items:         [saleItemSchema],
  subtotal:      { type: Number, required: true },
  discount:      { type: Number, default: 0 },
  tax:           { type: Number, default: 0 },
  total:         { type: Number, required: true },
  paid:          { type: Number, default: 0 },
  balance:       { type: Number, default: 0 },
  paymentMode:   { type: String, enum: ['cash', 'credit', 'upi', 'bank_transfer'], default: 'credit' },
  status:        { type: String, enum: ['pending', 'paid', 'partial', 'cancelled'], default: 'pending' },
  saleDate:      { type: Date, default: Date.now },
  notes:         { type: String },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Auto-generate invoice number
saleSchema.pre('save', async function (next) {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('Sale').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
