const express = require('express');

module.exports = function (db, authenticate, requireRole, logActivity, validators, updateHelpers) {
  const router = express.Router();

  // Get sales
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { start_date, end_date, retailer_id } = req.query;

      const query = db('sales as s')
        .join('retailers as r', 's.retailer_id', 'r.id')
        .join('skus as sk', 's.sku_id', 'sk.id')
        .join('brands as b', 'sk.brand_id', 'b.id')
        .select('s.*', 'r.name as retailer_name', 'sk.name as sku_name', 'b.name as brand_name');

      if (start_date) {
        query.whereRaw('DATE(s.date) >= ?', [start_date]);
      }
      if (end_date) {
        query.whereRaw('DATE(s.date) <= ?', [end_date]);
      }
      if (retailer_id) {
        query.where('s.retailer_id', retailer_id);
      }

      const rows = await query.orderBy('s.timestamp', 'desc').limit(1000);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // Create sale (dispatch)
  router.post('/', authenticate, validators.sale, async (req, res, next) => {
    const { date, retailer_id, items, payment_type } = req.body;

    try {
      // Use Knex transaction
      await db.transaction(async trx => {
        // Get retailer
        const retailer = await trx('retailers').where('id', retailer_id).first();
        if (!retailer) {
          throw { status: 404, message: 'Retailer not found' };
        }

        // Check credit status
        if (payment_type === 'credit' && retailer.credit_frozen) {
          throw { status: 400, message: 'Credit frozen for this retailer' };
        }

        let totalAmount = 0;
        let totalProfit = 0;
        const skuDetails = [];

        // Validate items and calculate totals
        for (const item of items) {
          const sku = await trx('skus').where('id', item.sku_id).first();
          if (!sku) {
            throw { status: 404, message: `SKU with ID ${item.sku_id} not found` };
          }
          if (sku.stock_in_hand < item.quantity) {
            throw { status: 400, message: `Insufficient stock for ${sku.name}. Available: ${sku.stock_in_hand}` };
          }

          const amount = sku.selling_price * item.quantity;
          const profit = (sku.selling_price - sku.purchase_price) * item.quantity;
          totalAmount += amount;
          totalProfit += profit;

          skuDetails.push({ ...item, sku, amount, profit });
        }

        // Check credit limit
        if (payment_type === 'credit' && (retailer.outstanding_amount + totalAmount) > retailer.credit_limit) {
          throw {
            status: 400,
            message: `Credit limit exceeded. Limit: ${retailer.credit_limit}, Outstanding: ${retailer.outstanding_amount}, New sale: ${totalAmount}`
          };
        }

        // Process updates
        for (const item of skuDetails) {
          // Update stock
          await trx('skus')
            .where('id', item.sku_id)
            .decrement('stock_in_hand', item.quantity)
            .update('last_sale_date', new Date().toISOString());

          // Insert sale
          const [saleId] = await trx('sales').insert({
            date,
            retailer_id,
            sku_id: item.sku_id,
            quantity: item.quantity,
            unit_price: item.sku.selling_price,
            gross_profit: item.profit,
            payment_type,
            timestamp: new Date().toISOString()
          }); // Sqlite returns array of IDs

          // Insert stock transaction
          await trx('stock_transactions').insert({
            sku_id: item.sku_id,
            quantity: -item.quantity,
            transaction_type: 'SALE',
            reference_id: saleId,
            timestamp: new Date().toISOString()
          });
        }

        // Update retailer outstanding
        if (payment_type === 'credit') {
          await trx('retailers')
            .where('id', retailer_id)
            .increment('outstanding_amount', totalAmount);
        }

        // Response data
        // We log outside transaction or assume success if we got here
        logActivity(req.user.id, 'CREATE_SALE', { retailer_id, total_amount: totalAmount, items_count: items.length });

        res.status(201).json({
          success: true,
          total_amount: totalAmount,
          total_profit: totalProfit
        });
      });

      // Post-transaction background updates
      if (updateHelpers) {
        // Run asynchronously without awaiting response
        Promise.all([
          updateHelpers.updateSKUStatuses(),
          updateHelpers.updateRetailerDaysOutstanding(),
          updateHelpers.generateAlerts()
        ]).catch(err => console.error('Background update error:', err));
      }

    } catch (error) {
      if (error.status) {
        res.status(error.status).json({ error: error.message });
      } else {
        next(error);
      }
    }
  });

  return router;
};
