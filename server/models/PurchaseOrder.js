const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
  sku:      { type: mongoose.Schema.Types.ObjectId, ref: 'SKU' },
  skuName:  { type: String },
  quantity: { type: Number, required: true, min: 1 },
  price:    { type: Number, required: true, min: 0 },
  total:    { type: Number, required: true },
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber:     { type: String, unique: true },
  supplier:     { type: String, required: true, trim: true },
  supplierPhone:{ type: String },
  items:        [poItemSchema],
  subtotal:     { type: Number, default: 0 },
  tax:          { type: Number, default: 0 },
  total:        { type: Number, default: 0 },
  status:       { type: String, enum: ['draft', 'ordered', 'received', 'cancelled'], default: 'draft' },
  orderDate:    { type: Date, default: Date.now },
  expectedDate: { type: Date },
  receivedDate: { type: Date },
  notes:        { type: String },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

purchaseOrderSchema.pre('save', async function (next) {
  if (!this.poNumber) {
    const count = await mongoose.model('PurchaseOrder').countDocuments();
    this.poNumber = `PO-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
