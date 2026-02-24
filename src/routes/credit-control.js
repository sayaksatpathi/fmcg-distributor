const express = require('express');

module.exports = function(db, authenticate, requireRole, logActivity, validators) {
  const router = express.Router();

  // Get credit control overview
  router.get('/', authenticate, (req, res, next) => {
    db.all(`
      SELECT r.*,
             CASE 
               WHEN r.outstanding_amount = 0 THEN '0-7'
               WHEN r.days_outstanding <= 7 THEN '0-7'
               WHEN r.days_outstanding <= 15 THEN '8-15'
               WHEN r.days_outstanding <= 30 THEN '16-30'
               ELSE '30+'
             END as aging_bucket
      FROM retailers r
      WHERE r.outstanding_amount > 0
      ORDER BY r.days_outstanding DESC, r.outstanding_amount DESC
    `, [], (err, rows) => {
      if (err) return next(err);
      
      const buckets = { '0-7': [], '8-15': [], '16-30': [], '30+': [] };
      rows.forEach(row => {
        buckets[row.aging_bucket].push(row);
      });
      
      res.json(buckets);
    });
  });

  // Record payment
  router.post('/payments', authenticate, requireRole('owner', 'accountant'), validators.payment, (req, res, next) => {
    const { retailer_id, amount, payment_date, payment_method } = req.body;
    
    // Verify retailer exists and has outstanding
    db.get('SELECT * FROM retailers WHERE id = ?', [retailer_id], (err, retailer) => {
      if (err) return next(err);
      if (!retailer) return res.status(404).json({ error: 'Retailer not found' });
      
      if (amount > retailer.outstanding_amount) {
        return res.status(400).json({ 
          error: `Payment amount (₹${amount}) exceeds outstanding amount (₹${retailer.outstanding_amount})` 
        });
      }
      
      db.run('BEGIN TRANSACTION');
      
      db.run(
        'INSERT INTO payments (retailer_id, amount, payment_date, payment_method, timestamp) VALUES (?, ?, ?, ?, ?)',
        [retailer_id, amount, payment_date, payment_method, new Date().toISOString()],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            return next(err);
          }
          
          const paymentId = this.lastID;
          
          db.run(
            'UPDATE retailers SET outstanding_amount = outstanding_amount - ?, updated_at = ? WHERE id = ?',
            [amount, new Date().toISOString(), retailer_id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                return next(err);
              }
              
              // Reset days outstanding if fully paid
              db.get('SELECT outstanding_amount FROM retailers WHERE id = ?', [retailer_id], (err, row) => {
                if (!err && row && row.outstanding_amount <= 0) {
                  db.run('UPDATE retailers SET days_outstanding = 0 WHERE id = ?', [retailer_id]);
                }
                
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    return next(err);
                  }
                  logActivity(req.user.id, 'CREATE_PAYMENT', { retailer_id, amount, payment_id: paymentId });
                  res.status(201).json({ success: true, payment_id: paymentId });
                });
              });
            }
          );
        }
      );
    });
  });

  // Get payment history
  router.get('/payments', authenticate, (req, res, next) => {
    const { retailer_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT p.*, r.name as retailer_name
      FROM payments p
      JOIN retailers r ON p.retailer_id = r.id
      WHERE 1=1
    `;
    const params = [];
    
    if (retailer_id) {
      query += ' AND p.retailer_id = ?';
      params.push(retailer_id);
    }
    if (start_date) {
      query += ' AND DATE(p.payment_date) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(p.payment_date) <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY p.timestamp DESC LIMIT 500';
    
    db.all(query, params, (err, rows) => {
      if (err) return next(err);
      res.json(rows);
    });
  });

  // Freeze/Unfreeze credit for retailer
  router.patch('/freeze/:id', authenticate, requireRole('owner', 'accountant'), validators.idParam, (req, res, next) => {
    const { id } = req.params;
    const { frozen } = req.body;
    
    db.run(
      'UPDATE retailers SET credit_frozen = ?, updated_at = ? WHERE id = ?',
      [frozen ? 1 : 0, new Date().toISOString(), id],
      function(err) {
        if (err) return next(err);
        if (this.changes === 0) return res.status(404).json({ error: 'Retailer not found' });
        logActivity(req.user.id, frozen ? 'FREEZE_CREDIT' : 'UNFREEZE_CREDIT', { retailer_id: id });
        res.json({ success: true });
      }
    );
  });

  return router;
};
