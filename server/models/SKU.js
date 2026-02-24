const mongoose = require('mongoose');

const skuSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  code:          { type: String, required: true, unique: true, trim: true },
  brand:         { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true },
  category:      { type: String, trim: true },
  unitSize:      { type: String, trim: true },  // e.g. "500ml", "1kg"
  mrp:           { type: Number, required: true, min: 0 },
  sellingPrice:  { type: Number, required: true, min: 0 },
  purchasePrice: { type: Number, default: 0 },
  stock:         { type: Number, default: 0 },
  minStock:      { type: Number, default: 10 },
  unit:          { type: String, default: 'pcs' },
  active:        { type: Boolean, default: true },
  description:   { type: String },
}, { timestamps: true });

module.exports = mongoose.model('SKU', skuSchema);
