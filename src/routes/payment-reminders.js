/**
 * Payment Reminders System
 * Automated reminders for retailer dues and payment tracking
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
   * GET /api/payment-reminders
   * Get all payment reminders
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { status = 'pending', days_overdue } = req.query;

      let query = `
        SELECT 
          pr.*,
          r.name as retailer_name,
          r.phone as retailer_phone,
          r.outstanding_balance,
          r.credit_limit
        FROM payment_reminders pr
        JOIN retailers r ON pr.retailer_id = r.id
        WHERE 1=1
      `;
      const params = [];

      if (status !== 'all') {
        query += ' AND pr.status = ?';
        params.push(status);
      }

      if (days_overdue) {
        query += ' AND pr.days_overdue >= ?';
        params.push(parseInt(days_overdue));
      }

      query += ' ORDER BY pr.due_date ASC';

      const reminders = await dbAll(db, query, params);
      res.json(reminders);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/payment-reminders/overdue
   * Get all overdue payments
   */
  router.get('/overdue', authenticate, async (req, res, next) => {
    try {
      const retailers = await dbAll(db, `
        SELECT 
          r.id,
          r.name,
          r.phone,
          r.email,
          r.outstanding_balance,
          r.credit_limit,
          r.last_payment_date,
          CAST(julianday('now') - julianday(r.last_payment_date) AS INTEGER) as days_since_payment,
          CASE 
            WHEN r.outstanding_balance > r.credit_limit THEN 'EXCEEDED'
            WHEN r.outstanding_balance > r.credit_limit * 0.8 THEN 'HIGH'
            WHEN r.outstanding_balance > r.credit_limit * 0.5 THEN 'MEDIUM'
            ELSE 'LOW'
          END as risk_level
        FROM retailers r
        WHERE r.outstanding_balance > 0
          AND (r.last_payment_date IS NULL OR r.last_payment_date < date('now', '-7 days'))
        ORDER BY r.outstanding_balance DESC
      `, []);

      const totalOverdue = retailers.reduce((sum, r) => sum + r.outstanding_balance, 0);

      res.json({
        retailers,
        summary: {
          totalRetailers: retailers.length,
          totalOverdue,
          exceededLimit: retailers.filter(r => r.risk_level === 'EXCEEDED').length,
          highRisk: retailers.filter(r => r.risk_level === 'HIGH').length
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/payment-reminders/due-today
   * Get payments due today
   */
  router.get('/due-today', authenticate, async (req, res, next) => {
    try {
      const reminders = await dbAll(db, `
        SELECT 
          pr.*,
          r.name as retailer_name,
          r.phone as retailer_phone
        FROM payment_reminders pr
        JOIN retailers r ON pr.retailer_id = r.id
        WHERE pr.due_date = date('now')
          AND pr.status = 'pending'
      `, []);

      res.json(reminders);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/payment-reminders/upcoming
   * Get upcoming payment due dates
   */
  router.get('/upcoming', authenticate, async (req, res, next) => {
    try {
      const { days = 7 } = req.query;

      const reminders = await dbAll(db, `
        SELECT 
          r.id,
          r.name as retailer_name,
          r.phone,
          r.outstanding_balance,
          r.payment_terms,
          r.last_payment_date,
          date(r.last_sale_date, '+' || COALESCE(r.payment_terms, 30) || ' days') as due_date
        FROM retailers r
        WHERE r.outstanding_balance > 0
          AND date(r.last_sale_date, '+' || COALESCE(r.payment_terms, 30) || ' days') <= date('now', '+' || ? || ' days')
        ORDER BY due_date ASC
      `, [days]);

      res.json(reminders);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/payment-reminders
   * Create a new payment reminder
   */
  router.post('/', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { retailer_id, amount, due_date, notes, reminder_type = 'manual' } = req.body;

      if (!retailer_id || !amount || !due_date) {
        return res.status(400).json({ error: 'retailer_id, amount, and due_date are required' });
      }

      const result = await dbRun(db, `
        INSERT INTO payment_reminders (retailer_id, amount, due_date, notes, reminder_type, status, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
      `, [retailer_id, amount, due_date, notes, reminder_type, req.user.id]);

      logActivity(req.user.id, 'CREATE_PAYMENT_REMINDER', { retailer_id, amount, due_date });

      res.json({ 
        success: true, 
        id: result.lastID 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/payment-reminders/auto-generate
   * Auto-generate reminders for all due payments
   */
  router.post('/auto-generate', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { days_threshold = 7 } = req.body;

      // Find all retailers with overdue payments
      const overdueRetailers = await dbAll(db, `
        SELECT 
          r.id,
          r.name,
          r.outstanding_balance,
          r.payment_terms,
          date(r.last_sale_date, '+' || COALESCE(r.payment_terms, 30) || ' days') as due_date
        FROM retailers r
        WHERE r.outstanding_balance > 0
          AND r.outstanding_balance > 100
          AND (r.last_sale_date IS NOT NULL)
          AND date(r.last_sale_date, '+' || COALESCE(r.payment_terms, 30) || ' days') <= date('now', '+' || ? || ' days')
          AND r.id NOT IN (
            SELECT retailer_id FROM payment_reminders 
            WHERE status = 'pending' AND created_at > date('now', '-7 days')
          )
      `, [days_threshold]);

      let created = 0;
      for (const retailer of overdueRetailers) {
        await dbRun(db, `
          INSERT INTO payment_reminders (retailer_id, amount, due_date, reminder_type, status, created_by, created_at)
          VALUES (?, ?, ?, 'auto', 'pending', ?, datetime('now'))
        `, [retailer.id, retailer.outstanding_balance, retailer.due_date, req.user.id]);
        created++;
      }

      logActivity(req.user.id, 'AUTO_GENERATE_REMINDERS', { count: created });

      res.json({ 
        success: true, 
        remindersCreated: created 
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/payment-reminders/:id/send
   * Mark reminder as sent
   */
  router.put('/:id/send', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { method = 'manual' } = req.body; // manual, sms, whatsapp, email

      await dbRun(db, `
        UPDATE payment_reminders 
        SET status = 'sent', sent_at = datetime('now'), sent_via = ?, sent_by = ?
        WHERE id = ?
      `, [method, req.user.id, id]);

      const reminder = await dbGet(db, `
        SELECT pr.*, r.name as retailer_name, r.phone
        FROM payment_reminders pr
        JOIN retailers r ON pr.retailer_id = r.id
        WHERE pr.id = ?
      `, [id]);

      logActivity(req.user.id, 'SEND_PAYMENT_REMINDER', { reminder_id: id, method, retailer: reminder.retailer_name });

      res.json({ 
        success: true, 
        reminder,
        message: generateReminderMessage(reminder)
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/payment-reminders/:id/acknowledge
   * Acknowledge reminder (customer contacted)
   */
  router.put('/:id/acknowledge', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { response, promised_date } = req.body;

      await dbRun(db, `
        UPDATE payment_reminders 
        SET status = 'acknowledged', customer_response = ?, promised_date = ?, acknowledged_at = datetime('now')
        WHERE id = ?
      `, [response, promised_date, id]);

      logActivity(req.user.id, 'ACKNOWLEDGE_REMINDER', { reminder_id: id, promised_date });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/payment-reminders/:id/complete
   * Mark reminder as completed (payment received)
   */
  router.put('/:id/complete', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { amount_received, payment_mode } = req.body;

      await dbRun(db, `
        UPDATE payment_reminders 
        SET status = 'completed', amount_received = ?, payment_mode = ?, completed_at = datetime('now')
        WHERE id = ?
      `, [amount_received, payment_mode, id]);

      logActivity(req.user.id, 'COMPLETE_PAYMENT_REMINDER', { reminder_id: id, amount_received });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/payment-reminders/:id
   * Cancel/delete a reminder
   */
  router.delete('/:id', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;

      await dbRun(db, 'UPDATE payment_reminders SET status = ? WHERE id = ?', ['cancelled', id]);

      logActivity(req.user.id, 'CANCEL_PAYMENT_REMINDER', { reminder_id: id });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/payment-reminders/retailer/:id
   * Get reminder history for a retailer
   */
  router.get('/retailer/:id', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;

      const reminders = await dbAll(db, `
        SELECT * FROM payment_reminders
        WHERE retailer_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `, [id]);

      const stats = await dbGet(db, `
        SELECT 
          COUNT(*) as total_reminders,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          AVG(CASE WHEN promised_date IS NOT NULL THEN 
            julianday(completed_at) - julianday(promised_date) 
          END) as avg_days_to_pay
        FROM payment_reminders
        WHERE retailer_id = ?
      `, [id]);

      res.json({ reminders, stats });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/payment-reminders/stats
   * Get reminder statistics
   */
  router.get('/stats', authenticate, async (req, res, next) => {
    try {
      const stats = await dbGet(db, `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'completed' THEN amount_received ELSE 0 END) as collected_amount
        FROM payment_reminders
        WHERE created_at >= date('now', '-30 days')
      `, []);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Helper function to generate reminder message
  function generateReminderMessage(reminder) {
    return `Dear ${reminder.retailer_name},

This is a friendly reminder that you have an outstanding balance of ₹${reminder.amount.toLocaleString()} due on ${reminder.due_date}.

Please arrange for the payment at your earliest convenience.

Thank you for your business!

[Your Company Name]`;
  }

  return router;
};
