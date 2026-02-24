/**
 * Inventory Alerts System
 * Low stock warnings, reorder points, and automated alerts
 */

const express = require('express');

module.exports = function (db, authenticate, requireRole, logActivity) {
  const router = express.Router();

  // Default thresholds (configurable per SKU)
  const DEFAULT_THRESHOLDS = {
    lowStock: 10,
    criticalStock: 5,
    daysOfInventory: 7,
    deadStockDays: 90
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
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * GET /api/inventory-alerts
   * Get all active inventory alerts
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const alerts = await generateInventoryAlerts(db);
      res.json(alerts);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/inventory-alerts/summary
   * Get alert summary counts
   */
  router.get('/summary', authenticate, async (req, res, next) => {
    try {
      const alerts = await generateInventoryAlerts(db);

      const summary = {
        outOfStock: alerts.filter(a => a.type === 'OUT_OF_STOCK').length,
        criticalStock: alerts.filter(a => a.type === 'CRITICAL_STOCK').length,
        lowStock: alerts.filter(a => a.type === 'LOW_STOCK').length,
        lowDaysInventory: alerts.filter(a => a.type === 'LOW_DAYS_INVENTORY').length,
        deadStock: alerts.filter(a => a.type === 'DEAD_STOCK').length,
        overstock: alerts.filter(a => a.type === 'OVERSTOCK').length,
        total: alerts.length
      };

      res.json(summary);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/inventory-alerts/out-of-stock
   * Get out of stock items
   */
  router.get('/out-of-stock', authenticate, async (req, res, next) => {
    try {
      const items = await dbAll(db, `
        SELECT 
          sk.id,
          sk.name as sku_name,
          b.name as brand_name,
          sk.stock_in_hand,
          sk.avg_monthly_sale,
          sk.last_sale_date,
          sk.purchase_price,
          (SELECT COUNT(*) FROM sales WHERE sku_id = sk.id AND date >= date('now', '-30 days')) as recent_sales
        FROM skus sk
        JOIN brands b ON sk.brand_id = b.id
        WHERE sk.stock_in_hand = 0
        ORDER BY sk.avg_monthly_sale DESC
      `, []);

      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/inventory-alerts/low-stock
   * Get low stock items
   */
  router.get('/low-stock', authenticate, async (req, res, next) => {
    try {
      const items = await dbAll(db, `
        SELECT 
          sk.id,
          sk.name as sku_name,
          b.name as brand_name,
          sk.stock_in_hand,
          sk.avg_monthly_sale,
          sk.days_of_inventory,
          sk.reorder_point,
          sk.reorder_quantity,
          sk.purchase_price,
          CASE 
            WHEN sk.stock_in_hand = 0 THEN 'OUT_OF_STOCK'
            WHEN sk.stock_in_hand <= COALESCE(sk.reorder_point, 5) THEN 'CRITICAL'
            WHEN sk.stock_in_hand <= COALESCE(sk.reorder_point, 10) * 2 THEN 'LOW'
            ELSE 'NORMAL'
          END as stock_status
        FROM skus sk
        JOIN brands b ON sk.brand_id = b.id
        WHERE sk.stock_in_hand <= COALESCE(sk.reorder_point, 10) * 2
        ORDER BY sk.stock_in_hand ASC
      `, []);

      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/inventory-alerts/dead-stock
   * Get dead stock items (no sales in 90 days)
   */
  router.get('/dead-stock', authenticate, async (req, res, next) => {
    try {
      const items = await dbAll(db, `
        SELECT 
          sk.id,
          sk.name as sku_name,
          b.name as brand_name,
          sk.stock_in_hand,
          sk.purchase_price,
          (sk.stock_in_hand * sk.purchase_price) as locked_capital,
          sk.last_sale_date,
          CAST(julianday('now') - julianday(sk.last_sale_date) AS INTEGER) as days_since_sale
        FROM skus sk
        JOIN brands b ON sk.brand_id = b.id
        WHERE sk.stock_in_hand > 0
          AND (sk.last_sale_date IS NULL OR sk.last_sale_date < date('now', '-90 days'))
        ORDER BY locked_capital DESC
      `, []);

      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/inventory-alerts/reorder-suggestions
   * Get suggested reorder quantities
   */
  router.get('/reorder-suggestions', authenticate, async (req, res, next) => {
    try {
      const suggestions = await dbAll(db, `
        SELECT 
          sk.id,
          sk.name as sku_name,
          b.name as brand_name,
          sk.stock_in_hand as current_stock,
          sk.avg_monthly_sale,
          sk.days_of_inventory,
          COALESCE(sk.reorder_point, 10) as reorder_point,
          COALESCE(sk.reorder_quantity, sk.avg_monthly_sale * 2) as suggested_quantity,
          sk.purchase_price,
          (COALESCE(sk.reorder_quantity, sk.avg_monthly_sale * 2) * sk.purchase_price) as estimated_cost
        FROM skus sk
        JOIN brands b ON sk.brand_id = b.id
        WHERE sk.stock_in_hand <= COALESCE(sk.reorder_point, 10)
          AND sk.avg_monthly_sale > 0
        ORDER BY sk.days_of_inventory ASC
      `, []);

      const totalCost = suggestions.reduce((sum, s) => sum + s.estimated_cost, 0);

      res.json({
        suggestions,
        totalItems: suggestions.length,
        totalEstimatedCost: totalCost
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/inventory-alerts/sku/:id/thresholds
   * Set reorder thresholds for a SKU
   */
  router.put('/sku/:id/thresholds', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reorder_point, reorder_quantity, min_stock, max_stock } = req.body;

      await dbRun(db, `
        UPDATE skus 
        SET reorder_point = ?, reorder_quantity = ?, min_stock = ?, max_stock = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [reorder_point, reorder_quantity, min_stock, max_stock, id]);

      logActivity(req.user.id, 'UPDATE_SKU_THRESHOLDS', { sku_id: id, reorder_point, reorder_quantity });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/inventory-alerts/mark-all-read
   * Mark all active alerts as read/dismissed
   */
  router.post('/mark-all-read', authenticate, async (req, res, next) => {
    try {
      await dbRun(db, "UPDATE alerts SET status = 'read' WHERE status = 'active'", []);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/inventory-alerts/auto-generate
   * Auto-generate and save alerts to database
   */
  router.post('/auto-generate', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const alerts = await generateInventoryAlerts(db);

      // Clear old inventory alerts (keep active ones until dismissed, OR clear only automated ones?)
      // Current logic clears all inventory alerts first.
      await dbRun(db, "DELETE FROM alerts WHERE alert_type LIKE 'INVENTORY_%'", []);

      // Insert new alerts
      for (const alert of alerts) {
        await dbRun(db, `
          INSERT INTO alerts (alert_type, severity, message, entity_type, entity_id, status, created_at)
          VALUES (?, ?, ?, 'sku', ?, 'active', datetime('now'))
        `, [`INVENTORY_${alert.type}`, alert.severity, alert.message, alert.sku_id]);
      }

      logActivity(req.user.id, 'GENERATE_INVENTORY_ALERTS', { count: alerts.length });

      res.json({
        success: true,
        alertsGenerated: alerts.length
      });
    } catch (error) {
      next(error);
    }
  });

  // Helper function to generate alerts
  async function generateInventoryAlerts(db) {
    const alerts = [];

    // Out of stock
    const outOfStock = await dbAll(db, `
      SELECT sk.id, sk.name, b.name as brand_name, sk.avg_monthly_sale
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      WHERE sk.stock_in_hand = 0 AND sk.avg_monthly_sale > 0
    `, []);

    outOfStock.forEach(item => {
      alerts.push({
        type: 'OUT_OF_STOCK',
        severity: 'red',
        sku_id: item.id,
        sku_name: item.name,
        brand_name: item.brand_name,
        message: `${item.name} (${item.brand_name}) is OUT OF STOCK! Avg monthly sale: ${item.avg_monthly_sale}`
      });
    });

    // Critical stock
    const criticalStock = await dbAll(db, `
      SELECT sk.id, sk.name, b.name as brand_name, sk.stock_in_hand, COALESCE(sk.reorder_point, 5) as threshold
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      WHERE sk.stock_in_hand > 0 AND sk.stock_in_hand <= COALESCE(sk.reorder_point, 5)
    `, []);

    criticalStock.forEach(item => {
      alerts.push({
        type: 'CRITICAL_STOCK',
        severity: 'red',
        sku_id: item.id,
        sku_name: item.name,
        brand_name: item.brand_name,
        message: `${item.name} (${item.brand_name}) has CRITICAL stock: ${item.stock_in_hand} units`
      });
    });

    // Low stock
    const lowStock = await dbAll(db, `
      SELECT sk.id, sk.name, b.name as brand_name, sk.stock_in_hand, COALESCE(sk.reorder_point, 10) as threshold
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      WHERE sk.stock_in_hand > COALESCE(sk.reorder_point, 5) 
        AND sk.stock_in_hand <= COALESCE(sk.reorder_point, 10) * 2
    `, []);

    lowStock.forEach(item => {
      alerts.push({
        type: 'LOW_STOCK',
        severity: 'yellow',
        sku_id: item.id,
        sku_name: item.name,
        brand_name: item.brand_name,
        message: `${item.name} (${item.brand_name}) has LOW stock: ${item.stock_in_hand} units`
      });
    });

    // Low days of inventory
    const lowDays = await dbAll(db, `
      SELECT sk.id, sk.name, b.name as brand_name, sk.days_of_inventory, sk.stock_in_hand
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      WHERE sk.days_of_inventory > 0 AND sk.days_of_inventory < 7 AND sk.stock_in_hand > 0
    `, []);

    lowDays.forEach(item => {
      alerts.push({
        type: 'LOW_DAYS_INVENTORY',
        severity: 'yellow',
        sku_id: item.id,
        sku_name: item.name,
        brand_name: item.brand_name,
        message: `${item.name} (${item.brand_name}) has only ${Math.round(item.days_of_inventory)} days of inventory`
      });
    });

    // Dead stock
    const deadStock = await dbAll(db, `
      SELECT sk.id, sk.name, b.name as brand_name, sk.stock_in_hand, sk.purchase_price,
             CAST(julianday('now') - julianday(sk.last_sale_date) AS INTEGER) as days_since_sale
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      WHERE sk.stock_in_hand > 0
        AND (sk.last_sale_date IS NULL OR sk.last_sale_date < date('now', '-90 days'))
    `, []);

    deadStock.forEach(item => {
      alerts.push({
        type: 'DEAD_STOCK',
        severity: 'yellow',
        sku_id: item.id,
        sku_name: item.name,
        brand_name: item.brand_name,
        message: `${item.name} (${item.brand_name}) is DEAD STOCK - No sales in ${item.days_since_sale || 'N/A'} days. Value: ₹${item.stock_in_hand * item.purchase_price}`
      });
    });

    return alerts;
  }

  return router;
};

// Export the alert generator for use in scheduled jobs
module.exports.generateInventoryAlerts = async function (db) {
  function dbAll(db, sql, params) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  const alerts = [];

  const outOfStock = await dbAll(db, `
    SELECT sk.id, sk.name, b.name as brand_name
    FROM skus sk JOIN brands b ON sk.brand_id = b.id
    WHERE sk.stock_in_hand = 0 AND sk.avg_monthly_sale > 0
  `, []);

  outOfStock.forEach(item => {
    alerts.push({
      type: 'OUT_OF_STOCK',
      severity: 'red',
      sku_id: item.id,
      message: `${item.name} (${item.brand_name}) is OUT OF STOCK`
    });
  });

  return alerts;
};
