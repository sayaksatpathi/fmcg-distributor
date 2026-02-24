/**
 * WhatsApp Integration Service
 * Send invoices, reminders, and notifications via WhatsApp
 * Uses WhatsApp Business API or WhatsApp Web integration
 */

const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity) {
  const router = express.Router();

  // WhatsApp configuration (to be set via environment variables or settings)
  const WHATSAPP_CONFIG = {
    apiUrl: process.env.WHATSAPP_API_URL || '',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessName: process.env.BUSINESS_NAME || 'Your Business'
  };

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
   * GET /api/whatsapp/status
   * Check WhatsApp integration status
   */
  router.get('/status', authenticate, async (req, res, next) => {
    try {
      const isConfigured = !!(WHATSAPP_CONFIG.apiUrl && WHATSAPP_CONFIG.apiKey);
      
      res.json({
        configured: isConfigured,
        mode: isConfigured ? 'api' : 'manual',
        businessName: WHATSAPP_CONFIG.businessName
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/whatsapp/send-invoice
   * Send invoice via WhatsApp
   */
  router.post('/send-invoice', authenticate, async (req, res, next) => {
    try {
      const { invoice_id, retailer_id, phone } = req.body;

      if (!invoice_id || (!retailer_id && !phone)) {
        return res.status(400).json({ error: 'invoice_id and retailer_id or phone required' });
      }

      // Get invoice details
      const invoice = await dbGet(db, `
        SELECT 
          i.*,
          r.name as retailer_name,
          r.phone as retailer_phone
        FROM invoices i
        JOIN retailers r ON i.retailer_id = r.id
        WHERE i.id = ?
      `, [invoice_id]);

      if (!invoice.id) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const targetPhone = phone || invoice.retailer_phone;
      if (!targetPhone) {
        return res.status(400).json({ error: 'No phone number available' });
      }

      // Get invoice items
      const items = await dbAll(db, `
        SELECT ii.*, s.name as sku_name
        FROM invoice_items ii
        JOIN skus s ON ii.sku_id = s.id
        WHERE ii.invoice_id = ?
      `, [invoice_id]);

      // Generate invoice message
      const message = generateInvoiceMessage(invoice, items);

      // Send via WhatsApp (API or generate link for manual sending)
      const result = await sendWhatsAppMessage(targetPhone, message);

      // Log the send attempt
      await dbRun(db, `
        INSERT INTO whatsapp_logs (message_type, recipient_phone, retailer_id, reference_id, reference_type, status, created_by, created_at)
        VALUES ('invoice', ?, ?, ?, 'invoice', ?, ?, datetime('now'))
      `, [targetPhone, retailer_id || invoice.retailer_id, invoice_id, result.status, req.user.id]);

      logActivity(req.user.id, 'SEND_WHATSAPP_INVOICE', { invoice_id, phone: targetPhone });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/whatsapp/send-reminder
   * Send payment reminder via WhatsApp
   */
  router.post('/send-reminder', authenticate, async (req, res, next) => {
    try {
      const { retailer_id, phone, custom_message } = req.body;

      if (!retailer_id && !phone) {
        return res.status(400).json({ error: 'retailer_id or phone required' });
      }

      let retailer = {};
      if (retailer_id) {
        retailer = await dbGet(db, 'SELECT * FROM retailers WHERE id = ?', [retailer_id]);
        if (!retailer.id) {
          return res.status(404).json({ error: 'Retailer not found' });
        }
      }

      const targetPhone = phone || retailer.phone;
      if (!targetPhone) {
        return res.status(400).json({ error: 'No phone number available' });
      }

      // Generate reminder message
      const message = custom_message || generateReminderMessage(retailer);

      // Send via WhatsApp
      const result = await sendWhatsAppMessage(targetPhone, message);

      // Log the send attempt
      await dbRun(db, `
        INSERT INTO whatsapp_logs (message_type, recipient_phone, retailer_id, status, created_by, created_at)
        VALUES ('reminder', ?, ?, ?, ?, datetime('now'))
      `, [targetPhone, retailer_id, result.status, req.user.id]);

      logActivity(req.user.id, 'SEND_WHATSAPP_REMINDER', { retailer_id, phone: targetPhone });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/whatsapp/send-bulk-reminders
   * Send reminders to multiple retailers
   */
  router.post('/send-bulk-reminders', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { retailer_ids, min_outstanding = 0 } = req.body;

      let retailers;
      if (retailer_ids && retailer_ids.length > 0) {
        retailers = await dbAll(db, `
          SELECT * FROM retailers 
          WHERE id IN (${retailer_ids.map(() => '?').join(',')})
          AND phone IS NOT NULL
          AND outstanding_balance > ?
        `, [...retailer_ids, min_outstanding]);
      } else {
        // Send to all retailers with outstanding > threshold
        retailers = await dbAll(db, `
          SELECT * FROM retailers 
          WHERE phone IS NOT NULL 
          AND outstanding_balance > ?
          ORDER BY outstanding_balance DESC
          LIMIT 50
        `, [min_outstanding]);
      }

      const results = {
        sent: 0,
        failed: 0,
        details: []
      };

      for (const retailer of retailers) {
        try {
          const message = generateReminderMessage(retailer);
          const result = await sendWhatsAppMessage(retailer.phone, message);
          
          await dbRun(db, `
            INSERT INTO whatsapp_logs (message_type, recipient_phone, retailer_id, status, created_by, created_at)
            VALUES ('bulk_reminder', ?, ?, ?, ?, datetime('now'))
          `, [retailer.phone, retailer.id, result.status, req.user.id]);

          if (result.status === 'sent' || result.status === 'link_generated') {
            results.sent++;
          } else {
            results.failed++;
          }

          results.details.push({
            retailer_id: retailer.id,
            name: retailer.name,
            status: result.status
          });
        } catch (e) {
          results.failed++;
          results.details.push({
            retailer_id: retailer.id,
            name: retailer.name,
            status: 'error',
            error: e.message
          });
        }
      }

      logActivity(req.user.id, 'SEND_BULK_WHATSAPP_REMINDERS', { sent: results.sent, failed: results.failed });

      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/whatsapp/send-custom
   * Send custom message via WhatsApp
   */
  router.post('/send-custom', authenticate, async (req, res, next) => {
    try {
      const { phone, message, retailer_id } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ error: 'phone and message required' });
      }

      const result = await sendWhatsAppMessage(phone, message);

      await dbRun(db, `
        INSERT INTO whatsapp_logs (message_type, recipient_phone, retailer_id, message_content, status, created_by, created_at)
        VALUES ('custom', ?, ?, ?, ?, ?, datetime('now'))
      `, [phone, retailer_id, message, result.status, req.user.id]);

      logActivity(req.user.id, 'SEND_WHATSAPP_CUSTOM', { phone });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/whatsapp/generate-link
   * Generate WhatsApp click-to-chat link
   */
  router.get('/generate-link', authenticate, async (req, res, next) => {
    try {
      const { phone, message } = req.query;

      if (!phone) {
        return res.status(400).json({ error: 'phone is required' });
      }

      const link = generateWhatsAppLink(phone, message || '');

      res.json({
        link,
        phone: formatPhoneNumber(phone)
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/whatsapp/logs
   * Get WhatsApp message logs
   */
  router.get('/logs', authenticate, async (req, res, next) => {
    try {
      const { retailer_id, message_type, status, limit = 100 } = req.query;

      let query = `
        SELECT 
          wl.*,
          r.name as retailer_name
        FROM whatsapp_logs wl
        LEFT JOIN retailers r ON wl.retailer_id = r.id
        WHERE 1=1
      `;
      const params = [];

      if (retailer_id) {
        query += ' AND wl.retailer_id = ?';
        params.push(retailer_id);
      }

      if (message_type) {
        query += ' AND wl.message_type = ?';
        params.push(message_type);
      }

      if (status) {
        query += ' AND wl.status = ?';
        params.push(status);
      }

      query += ' ORDER BY wl.created_at DESC LIMIT ?';
      params.push(parseInt(limit));

      const logs = await dbAll(db, query, params);

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/whatsapp/templates
   * Get message templates
   */
  router.get('/templates', authenticate, async (req, res, next) => {
    try {
      const templates = [
        {
          id: 'invoice',
          name: 'Invoice',
          template: `Dear {retailer_name},

Please find your invoice details below:

Invoice #: {invoice_number}
Date: {invoice_date}
Amount: ₹{total_amount}

Items:
{items_list}

Payment Due: {due_date}

Thank you for your business!
${WHATSAPP_CONFIG.businessName}`
        },
        {
          id: 'reminder',
          name: 'Payment Reminder',
          template: `Dear {retailer_name},

This is a friendly reminder about your outstanding balance.

Outstanding Amount: ₹{outstanding_balance}

Please arrange for the payment at your earliest convenience.

Thank you!
${WHATSAPP_CONFIG.businessName}`
        },
        {
          id: 'order_confirmation',
          name: 'Order Confirmation',
          template: `Dear {retailer_name},

Your order has been confirmed!

Order #: {order_number}
Items: {items_count}
Total: ₹{total_amount}

Expected Delivery: {delivery_date}

Thank you for your order!
${WHATSAPP_CONFIG.businessName}`
        },
        {
          id: 'dispatch',
          name: 'Dispatch Notification',
          template: `Dear {retailer_name},

Your order has been dispatched!

Invoice #: {invoice_number}
Dispatched via: {transport}

Track your delivery or contact us for any queries.

${WHATSAPP_CONFIG.businessName}`
        }
      ];

      res.json(templates);
    } catch (error) {
      next(error);
    }
  });

  // ============ Helper Functions ============

  async function sendWhatsAppMessage(phone, message) {
    const formattedPhone = formatPhoneNumber(phone);

    // If API is configured, use it
    if (WHATSAPP_CONFIG.apiUrl && WHATSAPP_CONFIG.apiKey) {
      try {
        // WhatsApp Business API call would go here
        // This is a placeholder for actual API integration
        // You would typically use axios or fetch to call the API
        
        /*
        const response = await fetch(`${WHATSAPP_CONFIG.apiUrl}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_CONFIG.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: { body: message }
          })
        });
        
        const data = await response.json();
        return { status: 'sent', messageId: data.messages[0].id };
        */

        // For now, return link generation as fallback
        return {
          status: 'api_not_implemented',
          link: generateWhatsAppLink(formattedPhone, message),
          message: 'API integration pending. Use the link to send manually.'
        };
      } catch (error) {
        console.error('WhatsApp API error:', error);
        return {
          status: 'error',
          error: error.message,
          link: generateWhatsAppLink(formattedPhone, message)
        };
      }
    }

    // Fallback: Generate click-to-chat link
    return {
      status: 'link_generated',
      link: generateWhatsAppLink(formattedPhone, message),
      message: 'Click the link to send via WhatsApp'
    };
  }

  function generateWhatsAppLink(phone, message) {
    const formattedPhone = formatPhoneNumber(phone);
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }

  function formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Add India country code if not present
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }

  function generateInvoiceMessage(invoice, items) {
    let itemsList = items.map(item => 
      `• ${item.sku_name} x ${item.quantity} = ₹${item.total.toLocaleString()}`
    ).join('\n');

    return `Dear ${invoice.retailer_name},

📄 *Invoice #${invoice.invoice_number}*
📅 Date: ${invoice.invoice_date}

*Items:*
${itemsList}

━━━━━━━━━━━━━━━
*Total: ₹${invoice.total_amount.toLocaleString()}*
━━━━━━━━━━━━━━━

💳 Payment Due: ${invoice.due_date || 'On Receipt'}

Thank you for your business! 🙏
*${WHATSAPP_CONFIG.businessName}*`;
  }

  function generateReminderMessage(retailer) {
    return `Dear ${retailer.name},

🔔 *Payment Reminder*

Your outstanding balance is:
*₹${(retailer.outstanding_balance || 0).toLocaleString()}*

Please arrange for the payment at your earliest convenience.

For any queries, feel free to contact us.

Thank you! 🙏
*${WHATSAPP_CONFIG.businessName}*`;
  }

  return router;
};
