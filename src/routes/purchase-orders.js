/**
 * Purchase Orders Routes
 * Track incoming stock from suppliers
 */

const express = require('express');

module.exports = function (db, authenticate, requireRole, logActivity, validators) {
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
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * GET /api/purchase-orders
   * List all purchase orders
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { status, supplier, start_date, end_date } = req.query;

      let query = `
        SELECT 
          po.*,
          (SELECT COUNT(*) FROM purchase_order_items WHERE purchase_order_id = po.id) as item_count,
          (SELECT SUM(quantity * unit_price) FROM purchase_order_items WHERE purchase_order_id = po.id) as total_amount
        FROM purchase_orders po
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        query += ' AND po.status = ?';
        params.push(status);
      }
      if (supplier) {
        query += ' AND po.supplier_name LIKE ?';
        params.push(`%${supplier}%`);
      }
      if (start_date) {
        query += ' AND DATE(po.order_date) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        query += ' AND DATE(po.order_date) <= ?';
        params.push(end_date);
      }

      query += ' ORDER BY po.order_date DESC';

      const orders = await dbAll(db, query, params);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/purchase-orders/pending/summary
   * Get summary of pending orders
   * NOTE: This route MUST be before /:id to avoid matching "pending" as an ID
   */
  router.get('/pending/summary', authenticate, async (req, res, next) => {
    try {
      const summary = await dbAll(db, `
        SELECT 
          COUNT(*) as total_pending,
          SUM(total_amount) as total_value,
          MIN(expected_date) as earliest_expected
        FROM purchase_orders
        WHERE status IN ('pending', 'partial')
      `, []);

      const bySupplier = await dbAll(db, `
        SELECT 
          supplier_name,
          COUNT(*) as order_count,
          SUM(total_amount) as total_value
        FROM purchase_orders
        WHERE status IN ('pending', 'partial')
        GROUP BY supplier_name
      `, []);

      res.json({
        summary: summary[0] || { total_pending: 0, total_value: 0, earliest_expected: null },
        bySupplier
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/purchase-orders/:id
   * Get single purchase order with items
   */
  router.get('/:id', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;

      const order = await dbGet(db, 'SELECT * FROM purchase_orders WHERE id = ?', [id]);
      if (!order.id) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      const items = await dbAll(db, `
        SELECT 
          poi.*,
          sk.name as sku_name,
          b.name as brand_name
        FROM purchase_order_items poi
        JOIN skus sk ON poi.sku_id = sk.id
        JOIN brands b ON sk.brand_id = b.id
        WHERE poi.purchase_order_id = ?
      `, [id]);

      res.json({ ...order, items });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/purchase-orders
   * Create new purchase order
   */
  router.post('/', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const {
        supplier_name,
        supplier_contact,
        order_date,
        expected_date,
        items,
        notes
      } = req.body;

      if (!supplier_name || !items || items.length === 0) {
        return res.status(400).json({ error: 'Supplier name and items are required' });
      }

      // Generate PO number
      const poCount = await dbGet(db, 'SELECT COUNT(*) as count FROM purchase_orders', []);
      const poNumber = `PO-${new Date().getFullYear()}-${String(poCount.count + 1).padStart(5, '0')}`;

      // Calculate total
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += item.quantity * item.unit_price;
      }

      // Create purchase order
      const result = await dbRun(db, `
        INSERT INTO purchase_orders (po_number, supplier_name, supplier_contact, order_date, expected_date, total_amount, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
      `, [poNumber, supplier_name, supplier_contact, order_date, expected_date, totalAmount, notes]);

      const poId = result.lastID;

      // Add items
      for (const item of items) {
        await dbRun(db, `
          INSERT INTO purchase_order_items (purchase_order_id, sku_id, quantity, unit_price, received_quantity)
          VALUES (?, ?, ?, ?, 0)
        `, [poId, item.sku_id, item.quantity, item.unit_price]);
      }

      logActivity(req.user.id, 'CREATE_PURCHASE_ORDER', { po_id: poId, po_number: poNumber, supplier: supplier_name });

      res.status(201).json({
        id: poId,
        po_number: poNumber,
        success: true
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/purchase-orders/:id/receive
   * Receive items from purchase order (update stock)
   */
  router.put('/:id/receive', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { items } = req.body; // Array of { item_id, received_quantity }

      const order = await dbGet(db, 'SELECT * FROM purchase_orders WHERE id = ?', [id]);
      if (!order.id) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      if (order.status === 'completed') {
        return res.status(400).json({ error: 'Purchase order already completed' });
      }

      await dbRun(db, 'BEGIN TRANSACTION', []);

      try {
        for (const item of items) {
          // Update received quantity
          await dbRun(db, `
            UPDATE purchase_order_items 
            SET received_quantity = received_quantity + ?
            WHERE id = ? AND purchase_order_id = ?
          `, [item.received_quantity, item.item_id, id]);

          // Get SKU ID
          const poItem = await dbGet(db, 'SELECT sku_id FROM purchase_order_items WHERE id = ?', [item.item_id]);

          // Update stock
          await dbRun(db, `
            UPDATE skus SET stock_in_hand = stock_in_hand + ? WHERE id = ?
          `, [item.received_quantity, poItem.sku_id]);

          // Record stock transaction
          await dbRun(db, `
            INSERT INTO stock_transactions (sku_id, quantity, transaction_type, reference_id, timestamp)
            VALUES (?, ?, 'PURCHASE', ?, datetime('now'))
          `, [poItem.sku_id, item.received_quantity, id]);
        }

        // Check if all items received
        const pending = await dbGet(db, `
          SELECT COUNT(*) as count 
          FROM purchase_order_items 
          WHERE purchase_order_id = ? AND received_quantity < quantity
        `, [id]);

        const newStatus = pending.count === 0 ? 'completed' : 'partial';

        await dbRun(db, `
          UPDATE purchase_orders 
          SET status = ?, received_date = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `, [newStatus, id]);

        await dbRun(db, 'COMMIT', []);

        logActivity(req.user.id, 'RECEIVE_PURCHASE_ORDER', { po_id: id, items: items.length });

        res.json({ success: true, status: newStatus });
      } catch (err) {
        await dbRun(db, 'ROLLBACK', []);
        throw err;
      }
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/purchase-orders/:id/cancel
   * Cancel purchase order
   */
  router.put('/:id/cancel', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const order = await dbGet(db, 'SELECT * FROM purchase_orders WHERE id = ?', [id]);
      if (!order.id) {
        return res.status(404).json({ error: 'Purchase order not found' });
      }

      if (order.status === 'completed') {
        return res.status(400).json({ error: 'Cannot cancel completed order' });
      }

      await dbRun(db, `
        UPDATE purchase_orders 
        SET status = 'cancelled', notes = notes || ' | Cancelled: ' || ?, updated_at = datetime('now')
        WHERE id = ?
      `, [reason || 'No reason provided', id]);

      logActivity(req.user.id, 'CANCEL_PURCHASE_ORDER', { po_id: id, reason });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // NOTE: /pending/summary route was moved above /:id to fix route matching order

  return router;
};
