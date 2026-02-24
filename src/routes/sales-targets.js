/**
 * Sales Targets System
 * Set and track sales targets by salesperson, product, or region
 */

const express = require('express');

module.exports = function (db, authenticate, requireRole, logActivity) {
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
   * GET /api/sales-targets
   * Get all sales targets
   */
  router.get('/', authenticate, async (req, res, next) => {
    try {
      const { period, target_type, status } = req.query;

      let query = `
        SELECT 
          st.*,
          u.username as assigned_to_name,
          b.name as brand_name,
          COALESCE(st.achieved_amount, 0) as achieved_amount,
          CASE 
            WHEN st.target_amount > 0 
            THEN ROUND((COALESCE(st.achieved_amount, 0) / st.target_amount) * 100, 1)
            ELSE 0 
          END as achievement_percentage
        FROM sales_targets st
        LEFT JOIN users u ON st.assigned_to = u.id
        LEFT JOIN brands b ON st.brand_id = b.id
        WHERE 1=1
      `;
      const params = [];

      if (period) {
        query += ' AND st.period = ?';
        params.push(period);
      }

      if (target_type) {
        query += ' AND st.target_type = ?';
        params.push(target_type);
      }

      if (status === 'active') {
        query += ' AND st.start_date <= date("now") AND st.end_date >= date("now")';
      }

      query += ' ORDER BY st.start_date DESC';

      const targets = await dbAll(db, query, params);
      res.json(targets);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/sales-targets/current
   * Get current active targets with progress
   */
  router.get('/current', authenticate, async (req, res, next) => {
    try {
      const targets = await dbAll(db, `
        SELECT 
          st.*,
          u.username as assigned_to_name,
          b.name as brand_name
        FROM sales_targets st
        LEFT JOIN users u ON st.assigned_to = u.id
        LEFT JOIN brands b ON st.brand_id = b.id
        WHERE st.start_date <= date('now') AND st.end_date >= date('now')
        ORDER BY st.end_date ASC
      `, []);

      const processedTargets = [];

      // Calculate progress for each target
      for (const target of targets) {
        try {
          const achieved = await calculateAchievement(db, target);
          target.achieved_amount = achieved.amount || 0;
          target.achieved_quantity = achieved.quantity || 0;
          target.achievement_percentage = target.target_amount > 0
            ? Math.round((target.achieved_amount / target.target_amount) * 100 * 10) / 10
            : 0;

          // Safe date calculation
          const endDate = new Date(target.end_date);
          const today = new Date();
          const diffTime = endDate - today;
          target.days_remaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          processedTargets.push(target);
        } catch (err) {
          console.error(`Error processing target ${target.id}:`, err);
          // Push it anyway with 0 achievement to avoid breaking the UI completely
          target.achieved_amount = 0;
          target.achievement_percentage = 0;
          target.days_remaining = 0;
          processedTargets.push(target);
        }
      }

      res.json(processedTargets);
    } catch (error) {
      console.error('Error fetching current targets:', error);
      next(error);
    }
  });

  /**
   * GET /api/sales-targets/summary
   * Get overall target summary
   * NOTE: This route MUST be defined before /:id to avoid being matched as an ID
   */
  router.get('/summary', authenticate, async (req, res, next) => {
    try {
      const activeTargets = await dbAll(db, `
        SELECT * FROM sales_targets
        WHERE start_date <= date('now') AND end_date >= date('now')
        AND status = 'active'
      `, []);

      let totalTarget = 0;
      let totalAchieved = 0;

      for (const target of activeTargets) {
        const achieved = await calculateAchievement(db, target);
        totalTarget += target.target_amount || 0;
        totalAchieved += achieved.amount || 0;
      }

      res.json({
        activeTargets: activeTargets.length,
        totalTarget,
        totalAchieved,
        overallPercentage: totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100 * 10) / 10 : 0,
        onTrack: activeTargets.filter(t => {
          const daysElapsed = Math.ceil((new Date() - new Date(t.start_date)) / (1000 * 60 * 60 * 24));
          const totalDays = Math.ceil((new Date(t.end_date) - new Date(t.start_date)) / (1000 * 60 * 60 * 24));
          const expectedProgress = (daysElapsed / totalDays) * 100;
          const achieved = t.achieved_amount || 0;
          const percentage = t.target_amount > 0 ? (achieved / t.target_amount) * 100 : 0;
          return percentage >= expectedProgress * 0.9;
        }).length
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/sales-targets/leaderboard
   * Get sales leaderboard
   * NOTE: This route MUST be before /:id to avoid matching "leaderboard" as an ID
   */
  router.get('/leaderboard', authenticate, async (req, res, next) => {
    try {
      const { period = 'monthly' } = req.query;

      let dateFilter;
      switch (period) {
        case 'daily':
          dateFilter = "date('now')";
          break;
        case 'weekly':
          dateFilter = "date('now', '-7 days')";
          break;
        case 'monthly':
          dateFilter = "date('now', 'start of month')";
          break;
        case 'yearly':
          dateFilter = "date('now', 'start of year')";
          break;
        default:
          dateFilter = "date('now', 'start of month')";
      }

      const leaderboard = await dbAll(db, `
        SELECT 
          u.id,
          u.username,
          COUNT(DISTINCT s.id) as total_sales,
          COALESCE(SUM(s.quantity * s.unit_price), 0) as total_revenue,
          COALESCE(SUM(s.gross_profit), 0) as total_profit,
          COUNT(DISTINCT s.retailer_id) as unique_retailers,
          st.target_amount,
          CASE 
            WHEN st.target_amount > 0 
            THEN ROUND((SUM(s.quantity * s.unit_price) / st.target_amount) * 100, 1)
            ELSE NULL 
          END as achievement_percentage
        FROM users u
        LEFT JOIN sales s ON s.created_by = u.id AND s.date >= ${dateFilter}
        LEFT JOIN sales_targets st ON st.assigned_to = u.id 
          AND st.target_type = 'salesperson' 
          AND st.start_date <= date('now') 
          AND st.end_date >= date('now')
        WHERE u.role IN ('salesperson', 'owner', 'accountant')
        GROUP BY u.id
        ORDER BY total_revenue DESC
        LIMIT 20
      `, []);

      res.json(leaderboard);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/sales-targets/:id
   * Get specific target with detailed breakdown
   */
  router.get('/:id', authenticate, async (req, res, next) => {


    try {
      const { id } = req.params;

      const target = await dbGet(db, `
        SELECT 
          st.*,
          u.username as assigned_to_name,
          b.name as brand_name
        FROM sales_targets st
        LEFT JOIN users u ON st.assigned_to = u.id
        LEFT JOIN brands b ON st.brand_id = b.id
        WHERE st.id = ?
      `, [id]);

      if (!target.id) {
        return res.status(404).json({ error: 'Target not found' });
      }

      // Calculate achievement
      const achieved = await calculateAchievement(db, target);
      target.achieved_amount = achieved.amount;
      target.achieved_quantity = achieved.quantity;
      target.achievement_percentage = target.target_amount > 0
        ? Math.round((achieved.amount / target.target_amount) * 100 * 10) / 10
        : 0;

      // Get daily breakdown
      target.daily_breakdown = await getDailyBreakdown(db, target);

      res.json(target);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/sales-targets
   * Create a new sales target
   */
  router.post('/', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const {
        name,
        target_type, // 'salesperson', 'brand', 'overall', 'region'
        assigned_to,
        brand_id,
        target_amount,
        target_quantity,
        period, // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
        start_date,
        end_date,
        notes
      } = req.body;

      if (!name || !target_type || !target_amount || !start_date || !end_date) {
        return res.status(400).json({
          error: 'name, target_type, target_amount, start_date, and end_date are required'
        });
      }

      const result = await dbRun(db, `
        INSERT INTO sales_targets (
          name, target_type, assigned_to, brand_id, target_amount, target_quantity,
          period, start_date, end_date, notes, status, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'))
      `, [name, target_type, assigned_to, brand_id, target_amount, target_quantity, period, start_date, end_date, notes, req.user.id]);

      logActivity(req.user.id, 'CREATE_SALES_TARGET', { target_id: result.lastID, name, target_amount });

      res.json({
        success: true,
        id: result.lastID
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /api/sales-targets/:id
   * Update a sales target
   */
  router.put('/:id', authenticate, requireRole('owner', 'accountant'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        name,
        target_amount,
        target_quantity,
        end_date,
        notes,
        status
      } = req.body;

      await dbRun(db, `
        UPDATE sales_targets 
        SET name = COALESCE(?, name),
            target_amount = COALESCE(?, target_amount),
            target_quantity = COALESCE(?, target_quantity),
            end_date = COALESCE(?, end_date),
            notes = COALESCE(?, notes),
            status = COALESCE(?, status),
            updated_at = datetime('now')
        WHERE id = ?
      `, [name, target_amount, target_quantity, end_date, notes, status, id]);

      logActivity(req.user.id, 'UPDATE_SALES_TARGET', { target_id: id });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /api/sales-targets/:id
   * Delete/archive a sales target
   */
  router.delete('/:id', authenticate, requireRole('owner'), async (req, res, next) => {
    try {
      const { id } = req.params;

      await dbRun(db, 'UPDATE sales_targets SET status = ? WHERE id = ?', ['archived', id]);

      logActivity(req.user.id, 'DELETE_SALES_TARGET', { target_id: id });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // NOTE: /leaderboard route was moved above /:id to fix route matching order


  /**
   * GET /api/sales-targets/user/:userId
   * Get targets for specific user
   */
  router.get('/user/:userId', authenticate, async (req, res, next) => {
    try {
      const { userId } = req.params;

      const targets = await dbAll(db, `
        SELECT 
          st.*,
          b.name as brand_name
        FROM sales_targets st
        LEFT JOIN brands b ON st.brand_id = b.id
        WHERE st.assigned_to = ?
        ORDER BY st.start_date DESC
      `, [userId]);

      // Calculate achievement for each
      for (const target of targets) {
        const achieved = await calculateAchievement(db, target);
        target.achieved_amount = achieved.amount;
        target.achievement_percentage = target.target_amount > 0
          ? Math.round((achieved.amount / target.target_amount) * 100 * 10) / 10
          : 0;
      }

      res.json(targets);
    } catch (error) {
      next(error);
    }
  });

  // NOTE: /summary route was moved above /:id to fix route matching order


  // Helper function to calculate achievement for a target
  async function calculateAchievement(db, target) {
    let query = `
      SELECT 
        COALESCE(SUM(quantity * unit_price), 0) as amount,
        COALESCE(SUM(quantity), 0) as quantity
      FROM sales
      WHERE date >= ? AND date <= ?
    `;
    const params = [target.start_date, target.end_date];

    if (target.target_type === 'salesperson' && target.assigned_to) {
      query += ' AND created_by = ?';
      params.push(target.assigned_to);
    }

    if (target.target_type === 'brand' && target.brand_id) {
      query += ' AND sku_id IN (SELECT id FROM skus WHERE brand_id = ?)';
      params.push(target.brand_id);
    }

    return await dbGet(db, query, params);
  }

  // Helper function to get daily breakdown
  async function getDailyBreakdown(db, target) {
    let query = `
      SELECT 
        date,
        SUM(quantity * unit_price) as daily_amount,
        SUM(quantity) as daily_quantity
      FROM sales
      WHERE date >= ? AND date <= ?
    `;
    const params = [target.start_date, target.end_date];

    if (target.target_type === 'salesperson' && target.assigned_to) {
      query += ' AND created_by = ?';
      params.push(target.assigned_to);
    }

    query += ' GROUP BY date ORDER BY date';

    return await dbAll(db, query, params);
  }

  return router;
};
