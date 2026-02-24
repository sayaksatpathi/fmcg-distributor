/**
 * Invoice Generation Routes
 * Generate and manage invoices for sales
 */

const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity) {
  const router = express.Router();

  // Helper functions
  function dbGet(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  function dbAll(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  function dbRun(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * GET /api/invoices
   * List all invoices
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { retailer_id, status, start_date, end_date } = req.query;
      
      let query = `
        SELECT 
          i.*,
          r.name as retailer_name,
          r.phone as retailer_phone,
          r.area as retailer_area
        FROM invoices i
        JOIN retailers r ON i.retailer_id = r.id
        WHERE 1=1
      `;
      const params = [];

      if (retailer_id) {
        query += ' AND i.retailer_id = ?';
        params.push(retailer_id);
      }
      if (status) {
        query += ' AND i.status = ?';
        params.push(status);
      }
      if (start_date) {
        query += ' AND DATE(i.invoice_date) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        query += ' AND DATE(i.invoice_date) <= ?';
        params.push(end_date);
      }

      query += ' ORDER BY i.invoice_date DESC';

      const invoices = await dbAll(db, query, params);
      res.json(invoices);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/invoices/:id
   * Get single invoice with items
   */
  router.get('/:id', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const invoice = await dbGet(db, `
        SELECT 
          i.*,
          r.name as retailer_name,
          r.phone as retailer_phone,
          r.area as retailer_area,
          r.credit_class
        FROM invoices i
        JOIN retailers r ON i.retailer_id = r.id
        WHERE i.id = ?
      `, [id]);

      if (!invoice.id) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const items = await dbAll(db, `
        SELECT 
          ii.*,
          sk.name as sku_name,
          b.name as brand_name
        FROM invoice_items ii
        JOIN skus sk ON ii.sku_id = sk.id
        JOIN brands b ON sk.brand_id = b.id
        WHERE ii.invoice_id = ?
      `, [id]);

      // Company info (would come from settings in production)
      const company = {
        name: 'FMCG Distributor',
        address: 'Your Business Address',
        phone: 'Your Phone',
        gstin: 'Your GSTIN',
        email: 'your@email.com'
      };

      res.json({ ...invoice, items, company });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/invoices
   * Create invoice from sale
   */
  router.post('/', authenticate, async (req, res, next) => {
    try {
      const { retailer_id, items, payment_type, notes, discount } = req.body;

      if (!retailer_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'Retailer and items are required' });
      }

      // Get retailer
      const retailer = await dbGet(db, 'SELECT * FROM retailers WHERE id = ?', [retailer_id]);
      if (!retailer.id) {
        return res.status(404).json({ error: 'Retailer not found' });
      }

      // Generate invoice number
      const invCount = await dbGet(db, 'SELECT COUNT(*) as count FROM invoices', []);
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount.count + 1).padStart(6, '0')}`;

      // Calculate totals
      let subtotal = 0;
      let totalTax = 0;
      const itemDetails = [];

      for (const item of items) {
        const sku = await dbGet(db, 'SELECT * FROM skus WHERE id = ?', [item.sku_id]);
        if (!sku.id) {
          return res.status(404).json({ error: `SKU ${item.sku_id} not found` });
        }

        const amount = item.quantity * sku.selling_price;
        const tax = amount * 0.18; // 18% GST (configurable)
        
        subtotal += amount;
        totalTax += tax;
        
        itemDetails.push({
          sku_id: item.sku_id,
          quantity: item.quantity,
          unit_price: sku.selling_price,
          amount,
          tax_rate: 18,
          tax_amount: tax
        });
      }

      const discountAmount = discount || 0;
      const grandTotal = subtotal + totalTax - discountAmount;

      // Create invoice
      const result = await dbRun(db, `
        INSERT INTO invoices (
          invoice_number, retailer_id, invoice_date, due_date,
          subtotal, tax_amount, discount, grand_total,
          payment_type, status, notes, created_at
        ) VALUES (?, ?, datetime('now'), date('now', '+30 days'), ?, ?, ?, ?, ?, 'unpaid', ?, datetime('now'))
      `, [invoiceNumber, retailer_id, subtotal, totalTax, discountAmount, grandTotal, payment_type, notes]);

      const invoiceId = result.lastID;

      // Add items
      for (const item of itemDetails) {
        await dbRun(db, `
          INSERT INTO invoice_items (invoice_id, sku_id, quantity, unit_price, amount, tax_rate, tax_amount)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [invoiceId, item.sku_id, item.quantity, item.unit_price, item.amount, item.tax_rate, item.tax_amount]);
      }

      logActivity(req.user.id, 'CREATE_INVOICE', { invoice_id: invoiceId, invoice_number: invoiceNumber, retailer: retailer.name });

      res.status(201).json({
        id: invoiceId,
        invoice_number: invoiceNumber,
        grand_total: grandTotal,
        success: true
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/invoices/from-sale/:saleId
   * Generate invoice from existing sale
   */
  router.post('/from-sale/:saleId', authenticate, async (req, res, next) => {
    try {
      const { saleId } = req.params;

      // Get sale details
      const sale = await dbGet(db, `
        SELECT s.*, r.name as retailer_name
        FROM sales s
        JOIN retailers r ON s.retailer_id = r.id
        WHERE s.id = ?
      `, [saleId]);

      if (!sale.id) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      // Check if invoice already exists
      const existing = await dbGet(db, 'SELECT id FROM invoices WHERE sale_id = ?', [saleId]);
      if (existing.id) {
        return res.status(400).json({ error: 'Invoice already exists for this sale', invoice_id: existing.id });
      }

      // Generate invoice number
      const invCount = await dbGet(db, 'SELECT COUNT(*) as count FROM invoices', []);
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount.count + 1).padStart(6, '0')}`;

      const amount = sale.quantity * sale.unit_price;
      const tax = amount * 0.18;
      const grandTotal = amount + tax;

      // Create invoice
      const result = await dbRun(db, `
        INSERT INTO invoices (
          invoice_number, retailer_id, sale_id, invoice_date, due_date,
          subtotal, tax_amount, discount, grand_total,
          payment_type, status, created_at
        ) VALUES (?, ?, ?, datetime('now'), date('now', '+30 days'), ?, ?, 0, ?, ?, ?, datetime('now'))
      `, [invoiceNumber, sale.retailer_id, saleId, amount, tax, grandTotal, sale.payment_type, 
          sale.payment_type === 'cash' ? 'paid' : 'unpaid']);

      const invoiceId = result.lastID;

      // Add item
      await dbRun(db, `
        INSERT INTO invoice_items (invoice_id, sku_id, quantity, unit_price, amount, tax_rate, tax_amount)
        VALUES (?, ?, ?, ?, ?, 18, ?)
      `, [invoiceId, sale.sku_id, sale.quantity, sale.unit_price, amount, tax]);

      logActivity(req.user.id, 'CREATE_INVOICE_FROM_SALE', { invoice_id: invoiceId, sale_id: saleId });

      res.status(201).json({
        id: invoiceId,
        invoice_number: invoiceNumber,
        grand_total: grandTotal,
        success: true
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/invoices/:id/mark-paid
   * Mark invoice as paid
   */
  router.put('/:id/mark-paid', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { payment_date, payment_method } = req.body;

      await dbRun(db, `
        UPDATE invoices 
        SET status = 'paid', payment_date = ?, payment_method = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [payment_date || new Date().toISOString(), payment_method || 'cash', id]);

      logActivity(req.user.id, 'MARK_INVOICE_PAID', { invoice_id: id });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/invoices/:id/print
   * Get printable invoice data
   */
  router.get('/:id/print', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const invoice = await dbGet(db, `
        SELECT 
          i.*,
          r.name as retailer_name,
          r.phone as retailer_phone,
          r.area as retailer_area,
          r.credit_class
        FROM invoices i
        JOIN retailers r ON i.retailer_id = r.id
        WHERE i.id = ?
      `, [id]);

      if (!invoice.id) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const items = await dbAll(db, `
        SELECT 
          ii.*,
          sk.name as sku_name,
          b.name as brand_name
        FROM invoice_items ii
        JOIN skus sk ON ii.sku_id = sk.id
        JOIN brands b ON sk.brand_id = b.id
        WHERE ii.invoice_id = ?
      `, [id]);

      // Generate print-ready HTML
      const printData = {
        invoice,
        items,
        company: {
          name: 'FMCG Distributor',
          address: 'Your Business Address',
          phone: 'Your Phone',
          gstin: 'Your GSTIN'
        },
        printedAt: new Date().toISOString()
      };

      res.json(printData);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
