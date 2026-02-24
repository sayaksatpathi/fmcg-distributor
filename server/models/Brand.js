const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, unique: true },
  company:     { type: String, trim: true },
  category:    { type: String, trim: true },
  description: { type: String },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);
