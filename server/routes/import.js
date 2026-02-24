const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const Retailer = require('../models/Retailer');
const SKU = require('../models/SKU');
const Sale = require('../models/Sale');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/import/retailers
router.post('/retailers', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const inserted = await Retailer.insertMany(rows, { ordered: false }).catch(e => e.insertedDocs || []);
    res.json({ message: `Imported ${Array.isArray(inserted) ? inserted.length : inserted.insertedCount || 0} retailers.` });
  } catch (err) { next(err); }
});

// POST /api/import/skus
router.post('/skus', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const inserted = await SKU.insertMany(rows, { ordered: false }).catch(e => e.insertedDocs || []);
    res.json({ message: `Imported ${Array.isArray(inserted) ? inserted.length : inserted.insertedCount || 0} SKUs.` });
  } catch (err) { next(err); }
});

// POST /api/import/sales
router.post('/sales', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    res.json({ message: `Parsed ${rows.length} rows. Manual review required before import.`, preview: rows.slice(0, 5) });
  } catch (err) { next(err); }
});

module.exports = router;
