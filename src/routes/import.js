const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Secure file upload configuration
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only 1 file at a time
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();

    // Also check MIME type
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];

    if (allowedExtensions.includes(ext) &&
      (allowedMimes.includes(file.mimetype) || file.mimetype === 'application/octet-stream')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  }
});

// Constants for security limits
const MAX_ROWS = 10000;
const MAX_COLUMNS = 50;
const PARSE_TIMEOUT_MS = 30000;

/**
 * Safe Excel parsing using exceljs
 */
async function safeParseExcel(filePath) {
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();

  // Set up a timeout race
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Excel parsing timeout')), PARSE_TIMEOUT_MS);
  });

  const parsePromise = (async () => {
    await workbook.xlsx.readFile(filePath);

    if (workbook.worksheets.length === 0) {
      throw new Error('Excel file has no sheets');
    }

    const worksheet = workbook.worksheets[0];
    const data = [];
    const columns = [];

    // Validate dimensions
    if (worksheet.rowCount > MAX_ROWS) {
      throw new Error(`Too many rows (${worksheet.rowCount}). Maximum allowed: ${MAX_ROWS}`);
    }
    if (worksheet.columnCount > MAX_COLUMNS) {
      throw new Error(`Too many columns (${worksheet.columnCount}). Maximum allowed: ${MAX_COLUMNS}`);
    }

    // Extract headers from first row
    const headerRow = worksheet.getRow(1);
    if (!headerRow || headerRow.cellCount === 0) {
      throw new Error('Empty header row');
    }

    headerRow.eachCell((cell, colNumber) => {
      columns.push(cell.text || `Column${colNumber}`);
    });

    // Extract data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData = {};

      // Map cells to column names
      columns.forEach((colName, index) => {
        // exceljs cells are 1-based, so index + 1
        const cell = row.getCell(index + 1);

        let value = cell.value;

        // Handle rich text or formulas (simplify to text/result)
        if (value && typeof value === 'object') {
          if (value.result !== undefined) value = value.result;
          else if (value.text !== undefined) value = value.text;
          else if (value.hyperlink) value = value.text;
        }

        // Sanitize string values
        if (typeof value === 'string') {
          value = value
            .replace(/<[^>]*>/g, '') // Remove HTML
            .replace(/javascript:/gi, '') // Remove unsafe schemes
            .trim()
            .substring(0, 1000); // Limit length
        }

        rowData[colName] = value === null ? '' : value;
      });

      data.push(rowData);
    });

    return {
      data,
      columns,
      rowCount: data.length
    };
  })();

  return Promise.race([parsePromise, timeoutPromise]);
}

module.exports = function (db, authenticate, requireRole, logActivity) {
  const router = express.Router();

  // Upload and parse Excel file
  router.post('/excel', authenticate, requireRole('owner', 'accountant'), upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;

    try {
      const result = await safeParseExcel(filePath);

      // Clean up
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });

      if (result.data.length === 0) {
        return res.status(400).json({ error: 'Excel file is empty or contains no data rows' });
      }

      logActivity(req.user.id, 'EXCEL_UPLOAD', {
        filename: req.file.originalname,
        rows: result.rowCount,
        columns: result.columns.length
      });

      res.json(result);

    } catch (error) {
      // Clean up on error
      fs.unlink(filePath, () => { });

      console.error('Excel parse error:', error.message);
      return res.status(400).json({
        error: 'Failed to parse Excel file',
        details: error.message
      });
    }
  });

  // Import retailers from parsed data
  router.post('/retailers', authenticate, requireRole('owner', 'accountant'), (req, res, next) => {
    const { data, columnMapping } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data to import' });
    }

    let imported = 0;
    let errors = [];

    const processNext = (index) => {
      if (index >= data.length) {
        logActivity(req.user.id, 'IMPORT_RETAILERS', { count: imported, errors: errors.length });
        return res.json({
          success: true,
          imported,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      const row = data[index];
      const name = row[columnMapping.name];

      if (!name) {
        errors.push({ row: index + 1, error: 'Name is required' });
        return processNext(index + 1);
      }

      db.run(
        'INSERT INTO retailers (name, area, phone, credit_limit, credit_class, outstanding_amount) VALUES (?, ?, ?, ?, ?, ?)',
        [
          name,
          row[columnMapping.area] || '',
          row[columnMapping.phone] || '',
          parseFloat(row[columnMapping.credit_limit]) || 0,
          row[columnMapping.credit_class] || 'C',
          parseFloat(row[columnMapping.outstanding]) || 0
        ],
        function (err) {
          if (err) {
            errors.push({ row: index + 1, error: err.message });
          } else {
            imported++;
          }
          processNext(index + 1);
        }
      );
    };

    processNext(0);
  });

  // Import SKUs from parsed data
  router.post('/skus', authenticate, requireRole('owner', 'accountant'), (req, res, next) => {
    const { data, columnMapping, brandId } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data to import' });
    }

    if (!brandId) {
      return res.status(400).json({ error: 'Brand ID is required' });
    }

    let imported = 0;
    let errors = [];

    const processNext = (index) => {
      if (index >= data.length) {
        logActivity(req.user.id, 'IMPORT_SKUS', { count: imported, brand_id: brandId, errors: errors.length });
        return res.json({
          success: true,
          imported,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      const row = data[index];
      const name = row[columnMapping.name];
      const purchasePrice = parseFloat(row[columnMapping.purchase_price]);
      const sellingPrice = parseFloat(row[columnMapping.selling_price]);

      if (!name) {
        errors.push({ row: index + 1, error: 'Name is required' });
        return processNext(index + 1);
      }

      if (isNaN(purchasePrice) || isNaN(sellingPrice)) {
        errors.push({ row: index + 1, error: 'Valid prices are required' });
        return processNext(index + 1);
      }

      const margin = sellingPrice > 0 ? ((sellingPrice - purchasePrice) / sellingPrice * 100).toFixed(2) : 0;

      db.run(
        'INSERT INTO skus (name, brand_id, purchase_price, selling_price, margin_percent, stock_in_hand, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          name,
          brandId,
          purchasePrice,
          sellingPrice,
          margin,
          parseFloat(row[columnMapping.stock]) || 0,
          'SLOW'
        ],
        function (err) {
          if (err) {
            errors.push({ row: index + 1, error: err.message });
          } else {
            imported++;
          }
          processNext(index + 1);
        }
      );
    };

    processNext(0);
  });

  // Update stock from parsed data
  router.post('/stock', authenticate, requireRole('owner', 'accountant'), (req, res, next) => {
    const { data, columnMapping } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data to import' });
    }

    let updated = 0;
    let errors = [];

    const processNext = (index) => {
      if (index >= data.length) {
        logActivity(req.user.id, 'IMPORT_STOCK', { count: updated, errors: errors.length });
        return res.json({
          success: true,
          updated,
          errors: errors.length > 0 ? errors : undefined
        });
      }

      const row = data[index];
      const skuName = row[columnMapping.sku_name];
      const stock = parseFloat(row[columnMapping.stock]);

      if (!skuName) {
        errors.push({ row: index + 1, error: 'SKU name is required' });
        return processNext(index + 1);
      }

      if (isNaN(stock)) {
        errors.push({ row: index + 1, error: 'Valid stock quantity is required' });
        return processNext(index + 1);
      }

      db.run(
        'UPDATE skus SET stock_in_hand = ? WHERE name = ?',
        [stock, skuName],
        function (err) {
          if (err) {
            errors.push({ row: index + 1, error: err.message });
          } else if (this.changes === 0) {
            errors.push({ row: index + 1, error: `SKU '${skuName}' not found` });
          } else {
            updated++;
          }
          processNext(index + 1);
        }
      );
    };

    processNext(0);
  });

  return router;
};
