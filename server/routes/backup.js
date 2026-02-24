const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// POST /api/backup/export
router.post('/export', async (req, res, next) => {
  try {
    const models = mongoose.modelNames();
    const backup = {};
    for (const modelName of models) {
      backup[modelName] = await mongoose.model(modelName).find({}).lean();
    }
    const filename = `fmcg-backup-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) { next(err); }
});

// POST /api/backup/import
router.post('/import', express.json({ limit: '50mb' }), async (req, res, next) => {
  try {
    const data = req.body;
    const results = {};
    for (const [modelName, docs] of Object.entries(data)) {
      try {
        const Model = mongoose.model(modelName);
        await Model.deleteMany({});
        if (docs.length) await Model.insertMany(docs);
        results[modelName] = docs.length;
      } catch (e) {
        results[modelName] = `error: ${e.message}`;
      }
    }
    res.json({ message: 'Backup imported.', results });
  } catch (err) { next(err); }
});

module.exports = router;
