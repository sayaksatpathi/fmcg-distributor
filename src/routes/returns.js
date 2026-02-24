/**
 * Returns Management System
 * Handle product returns, damages, and refunds
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
   * GET /api/returns
   * Get all returns with filters
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { status, return_type, retailer_id, start_date, end_date, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          rt.*,
          r.name as retailer_name,
          s.name as sku_name,
          b.name as brand_name,
          u.username as processed_by_name
        FROM returns rt
        LEFT JOIN retailers r ON rt.retailer_id = r.id
        LEFT JOIN skus s ON rt.sku_id = s.id
        LEFT JOIN brands b ON s.brand_id = b.id
        LEFT JOIN users u ON rt.processed_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        query += ' AND rt.status = ?';
        params.push(status);
      }

      if (return_type) {
        query += ' AND rt.return_type = ?';
        params.push(return_type);
      }

      if (retailer_id) {
        query += ' AND rt.retailer_id = ?';
        params.push(retailer_id);
      }

      if (start_date) {
        query += ' AND rt.return_date >= ?';
        params.push(start_date);
      }

      if (end_date) {
        query += ' AND rt.return_date <= ?';
        params.push(end_date);
      }

      query += ` ORDER BY rt.return_date DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      const returns = await dbAll(db, query, params);

      // Get total count
      const countResult = await dbGet(db, `
        SELECT COUNT(*) as total FROM returns WHERE 1=1
        ${status ? 'AND status = ?' : ''}
        ${return_type ? 'AND return_type = ?' : ''}
      `, [status, return_type].filter(Boolean));

      res.json({
        returns,
        pagination: {
          total: countResult.total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(countResult.total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/returns/:id
   * Get specific return details
   */
  router.get('/:id', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;

      const returnItem = await dbGet(db, `
        SELECT 
          rt.*,
          r.name as retailer_name,
          r.phone as retailer_phone,
          s.name as sku_name,
          b.name as brand_name,
          u.username as processed_by_name,
          sale.invoice_number as original_invoice
        FROM returns rt
        LEFT JOIN retailers r ON rt.retailer_id = r.id
        LEFT JOIN skus s ON rt.sku_id = s.id
        LEFT JOIN brands b ON s.brand_id = b.id
        LEFT JOIN users u ON rt.processed_by = u.id
        LEFT JOIN sales sale ON rt.original_sale_id = sale.id
        WHERE rt.id = ?
      `, [id]);

      if (!returnItem.id) {
        return res.status(404).json({ error: 'Return not found' });
      }

      res.json(returnItem);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/returns
   * Create a new return
   */
  router.post('/', authenticate, async (req, res, next) => {
    try {
      const {
        retailer_id,
        sku_id,
        quantity,
        return_type, // 'damaged', 'expired', 'wrong_product', 'quality_issue', 'customer_return'
        reason,
        original_sale_id,
        refund_amount,
        action // 'refund', 'replace', 'credit_note'
      } = req.body;

      if (!retailer_id || !sku_id || !quantity || !return_type) {
        return res.status(400).json({ 
          error: 'retailer_id, sku_id, quantity, and return_type are required' 
        });
      }

      // Get SKU details for calculating refund
      const sku = await dbGet(db, 'SELECT * FROM skus WHERE id = ?', [sku_id]);
      if (!sku.id) {
        return res.status(404).json({ error: 'SKU not found' });
      }

      const calculatedRefund = refund_amount || (sku.selling_price * quantity);

      // Generate return number
      const returnNumber = `RET-${Date.now()}`;

      const result = await dbRun(db, `
        INSERT INTO returns (
          return_number, retailer_id, sku_id, quantity, return_type, reason,
          original_sale_id, refund_amount, action, status, return_date, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', date('now'), ?, datetime('now'))
      `, [returnNumber, retailer_id, sku_id, quantity, return_type, reason, original_sale_id, calculatedRefund, action, req.user.id]);

      logActivity(req.user.id, 'CREATE_RETURN', { return_id: result.lastID, sku_id, quantity, return_type });

      res.json({ 
        success: true, 
        id: result.lastID,
        return_number: returnNumber
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/returns/:id/approve
   * Approve a return request
   */
  router.put('/:id/approve', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { notes, adjusted_refund } = req.body;

      const returnItem = await dbGet(db, 'SELECT * FROM returns WHERE id = ?', [id]);
      if (!returnItem.id) {
        return res.status(404).json({ error: 'Return not found' });
      }

      const finalRefund = adjusted_refund || returnItem.refund_amount;

      await dbRun(db, `
        UPDATE returns 
        SET status = 'approved', 
            refund_amount = ?,
            approval_notes = ?,
            approved_by = ?,
            approved_at = datetime('now')
        WHERE id = ?
      `, [finalRefund, notes, req.user.id, id]);

      logActivity(req.user.id, 'APPROVE_RETURN', { return_id: id, refund_amount: finalRefund });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/returns/:id/process
   * Process an approved return (update stock, credit, etc.)
   */
  router.put('/:id/process', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;

      const returnItem = await dbGet(db, 'SELECT * FROM returns WHERE id = ?', [id]);
      if (!returnItem.id) {
        return res.status(404).json({ error: 'Return not found' });
      }

      if (returnItem.status !== 'approved') {
        return res.status(400).json({ error: 'Return must be approved before processing' });
      }

      // Start processing based on return type and action
      if (returnItem.return_type === 'damaged' || returnItem.return_type === 'expired') {
        // Don't add back to stock, write off
        await dbRun(db, `
          INSERT INTO inventory_adjustments (sku_id, quantity, adjustment_type, reason, created_by, created_at)
          VALUES (?, ?, 'write_off', ?, ?, datetime('now'))
        `, [returnItem.sku_id, -returnItem.quantity, `Return #${returnItem.return_number}: ${returnItem.reason}`, req.user.id]);
      } else {
        // Add back to stock (saleable returns)
        await dbRun(db, `
          UPDATE skus SET stock_in_hand = stock_in_hand + ? WHERE id = ?
        `, [returnItem.quantity, returnItem.sku_id]);
      }

      // Handle refund based on action
      if (returnItem.action === 'refund') {
        // Direct refund - reduce retailer outstanding
        await dbRun(db, `
          UPDATE retailers SET outstanding_balance = outstanding_balance - ? WHERE id = ?
        `, [returnItem.refund_amount, returnItem.retailer_id]);
      } else if (returnItem.action === 'credit_note') {
        // Create credit note
        await dbRun(db, `
          INSERT INTO credit_notes (retailer_id, amount, return_id, status, created_by, created_at)
          VALUES (?, ?, ?, 'active', ?, datetime('now'))
        `, [returnItem.retailer_id, returnItem.refund_amount, id, req.user.id]);
      }

      // Mark return as processed
      await dbRun(db, `
        UPDATE returns 
        SET status = 'processed',
            processed_by = ?,
            processed_at = datetime('now')
        WHERE id = ?
      `, [req.user.id, id]);

      logActivity(req.user.id, 'PROCESS_RETURN', { return_id: id, action: returnItem.action });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/returns/:id/reject
   * Reject a return request
   */
  router.put('/:id/reject', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      await dbRun(db, `
        UPDATE returns 
        SET status = 'rejected',
            rejection_reason = ?,
            rejected_by = ?,
            rejected_at = datetime('now')
        WHERE id = ?
      `, [reason, req.user.id, id]);

      logActivity(req.user.id, 'REJECT_RETURN', { return_id: id, reason });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/returns/stats
   * Get return statistics
   */
  router.get('/stats', authenticate, async (req, res, next) => {
    try {
      const { period = 'month' } = req.query;

      let dateFilter;
      switch (period) {
        case 'week':
          dateFilter = "date('now', '-7 days')";
          break;
        case 'month':
          dateFilter = "date('now', 'start of month')";
          break;
        case 'quarter':
          dateFilter = "date('now', '-3 months')";
          break;
        case 'year':
          dateFilter = "date('now', 'start of year')";
          break;
        default:
          dateFilter = "date('now', 'start of month')";
      }

      const stats = await dbGet(db, `
        SELECT 
          COUNT(*) as total_returns,
          SUM(quantity) as total_quantity,
          SUM(refund_amount) as total_refund_value,
          SUM(CASE WHEN return_type = 'damaged' THEN 1 ELSE 0 END) as damaged_count,
          SUM(CASE WHEN return_type = 'expired' THEN 1 ELSE 0 END) as expired_count,
          SUM(CASE WHEN return_type = 'customer_return' THEN 1 ELSE 0 END) as customer_return_count,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed_count
        FROM returns
        WHERE return_date >= ${dateFilter}
      `, []);

      // Top returned SKUs
      const topReturned = await dbAll(db, `
        SELECT 
          s.name as sku_name,
          b.name as brand_name,
          COUNT(*) as return_count,
          SUM(rt.quantity) as total_quantity,
          SUM(rt.refund_amount) as total_value
        FROM returns rt
        JOIN skus s ON rt.sku_id = s.id
        JOIN brands b ON s.brand_id = b.id
        WHERE rt.return_date >= ${dateFilter}
        GROUP BY rt.sku_id
        ORDER BY return_count DESC
        LIMIT 10
      `, []);

      // By return type
      const byType = await dbAll(db, `
        SELECT 
          return_type,
          COUNT(*) as count,
          SUM(quantity) as quantity,
          SUM(refund_amount) as value
        FROM returns
        WHERE return_date >= ${dateFilter}
        GROUP BY return_type
      `, []);

      res.json({
        summary: stats,
        topReturned,
        byType
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/returns/retailer/:id
   * Get returns history for a retailer
   */
  router.get('/retailer/:id', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;

      const returns = await dbAll(db, `
        SELECT 
          rt.*,
          s.name as sku_name,
          b.name as brand_name
        FROM returns rt
        JOIN skus s ON rt.sku_id = s.id
        JOIN brands b ON s.brand_id = b.id
        WHERE rt.retailer_id = ?
        ORDER BY rt.return_date DESC
        LIMIT 100
      `, [id]);

      const stats = await dbGet(db, `
        SELECT 
          COUNT(*) as total_returns,
          SUM(quantity) as total_quantity,
          SUM(refund_amount) as total_value
        FROM returns
        WHERE retailer_id = ?
      `, [id]);

      res.json({ returns, stats });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/returns/pending
   * Get all pending returns
   */
  router.get('/pending', authenticate, async (req, res, next) => {
    try {
      const returns = await dbAll(db, `
        SELECT 
          rt.*,
          r.name as retailer_name,
          s.name as sku_name,
          b.name as brand_name
        FROM returns rt
        JOIN retailers r ON rt.retailer_id = r.id
        JOIN skus s ON rt.sku_id = s.id
        JOIN brands b ON s.brand_id = b.id
        WHERE rt.status = 'pending'
        ORDER BY rt.return_date ASC
      `, []);

      res.json(returns);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
