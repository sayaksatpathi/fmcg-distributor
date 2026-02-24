const mongoose = require('mongoose');

const retailerSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  contactPerson:{ type: String, trim: true },
  phone:        { type: String, trim: true },
  phone2:       { type: String, trim: true },
  email:        { type: String, trim: true, lowercase: true },
  address:      { type: String, trim: true },
  area:         { type: String, trim: true },
  city:         { type: String, trim: true },
  gstin:        { type: String, trim: true },
  creditLimit:  { type: Number, default: 0 },
  outstandingBalance: { type: Number, default: 0 },
  status:       { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
  notes:        { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Retailer', retailerSchema);
