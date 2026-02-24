/**
 * Reports & PDF Export Routes
 * Generate and export various business reports
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

  /**
   * GET /api/reports/sales
   * Sales report with filters
   */
  router.get('/sales', authenticate, async (req, res, next) => {
    try {
      const { start_date, end_date, retailer_id, brand_id, group_by, period, days, limit } = req.query;
      
      // Handle period-based queries (for trend charts)
      if (period) {
        const daysAgo = days || 30;
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - parseInt(daysAgo));
        
        const trendData = await dbAll(db, `
          SELECT 
            s.date,
            SUM(s.quantity * s.unit_price) as revenue,
            SUM(s.gross_profit) as profit,
            COUNT(*) as transactions
          FROM sales s
          WHERE s.date >= ?
          GROUP BY s.date
          ORDER BY s.date ASC
        `, [dateFrom.toISOString().split('T')[0]]);
        
        return res.json(trendData);
      }
      
      let query = `
        SELECT 
          s.date,
          r.name as retailer_name,
          r.area,
          sk.name as sku_name,
          b.name as brand_name,
          s.quantity,
          s.unit_price,
          (s.quantity * s.unit_price) as total_amount,
          s.gross_profit,
          s.payment_type
        FROM sales s
        JOIN retailers r ON s.retailer_id = r.id
        JOIN skus sk ON s.sku_id = sk.id
        JOIN brands b ON sk.brand_id = b.id
        WHERE 1=1
      `;
      const params = [];

      if (start_date) {
        query += ' AND DATE(s.date) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        query += ' AND DATE(s.date) <= ?';
        params.push(end_date);
      }
      if (retailer_id) {
        query += ' AND s.retailer_id = ?';
        params.push(retailer_id);
      }
      if (brand_id) {
        query += ' AND sk.brand_id = ?';
        params.push(brand_id);
      }

      query += ' ORDER BY s.date DESC, s.timestamp DESC';

      const sales = await dbAll(db, query, params);

      // Calculate summary
      const summary = {
        totalSales: sales.reduce((sum, s) => sum + s.total_amount, 0),
        totalProfit: sales.reduce((sum, s) => sum + s.gross_profit, 0),
        totalQuantity: sales.reduce((sum, s) => sum + s.quantity, 0),
        transactionCount: sales.length,
        cashSales: sales.filter(s => s.payment_type === 'cash').reduce((sum, s) => sum + s.total_amount, 0),
        creditSales: sales.filter(s => s.payment_type === 'credit').reduce((sum, s) => sum + s.total_amount, 0)
      };

      // Group data if requested
      let groupedData = null;
      if (group_by === 'retailer') {
        groupedData = groupByField(sales, 'retailer_name');
      } else if (group_by === 'brand') {
        const grouped = groupByField(sales, 'brand_name');
        // Convert to array format for charts
        groupedData = Object.keys(grouped).map(brand_name => ({
          brand_name,
          revenue: grouped[brand_name].totalAmount,
          profit: grouped[brand_name].totalProfit,
          quantity: grouped[brand_name].totalQuantity,
          transaction_count: grouped[brand_name].items.length
        }));
      } else if (group_by === 'date') {
        groupedData = groupByField(sales, 'date');
      } else if (group_by === 'sku') {
        const grouped = groupByField(sales, 'sku_name');
        // Convert to array format for charts
        groupedData = Object.keys(grouped).map(sku_name => ({
          sku_name,
          revenue: grouped[sku_name].totalAmount,
          profit: grouped[sku_name].totalProfit,
          quantity: grouped[sku_name].totalQuantity,
          transaction_count: grouped[sku_name].items.length
        }));
        // Sort by quantity and apply limit
        groupedData.sort((a, b) => b.quantity - a.quantity);
        if (limit) {
          groupedData = groupedData.slice(0, parseInt(limit));
        }
      }

      // If group_by specified, return grouped data directly (for charts)
      if (group_by && Array.isArray(groupedData)) {
        return res.json(groupedData);
      }

      res.json({
        report: 'Sales Report',
        period: { start_date, end_date },
        generatedAt: new Date().toISOString(),
        summary,
        groupedData,
        data: sales
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reports/profit
   * Profit analysis report
   */
  router.get('/profit', authenticate, async (req, res, next) => {
    try {
      const { start_date, end_date } = req.query;
      
      let dateFilter = '';
      const params = [];
      
      if (start_date) {
        dateFilter += ' AND DATE(s.date) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        dateFilter += ' AND DATE(s.date) <= ?';
        params.push(end_date);
      }

      // Profit by brand
      const byBrand = await dbAll(db, `
        SELECT 
          b.name as brand_name,
          SUM(s.gross_profit) as total_profit,
          SUM(s.quantity * s.unit_price) as total_sales,
          SUM(s.quantity) as total_quantity,
          COUNT(*) as transaction_count,
          ROUND(SUM(s.gross_profit) * 100.0 / SUM(s.quantity * s.unit_price), 2) as profit_margin
        FROM sales s
        JOIN skus sk ON s.sku_id = sk.id
        JOIN brands b ON sk.brand_id = b.id
        WHERE 1=1 ${dateFilter}
        GROUP BY b.id
        ORDER BY total_profit DESC
      `, params);

      // Profit by retailer
      const byRetailer = await dbAll(db, `
        SELECT 
          r.name as retailer_name,
          r.area,
          SUM(s.gross_profit) as total_profit,
          SUM(s.quantity * s.unit_price) as total_sales,
          COUNT(*) as transaction_count
        FROM sales s
        JOIN retailers r ON s.retailer_id = r.id
        WHERE 1=1 ${dateFilter}
        GROUP BY r.id
        ORDER BY total_profit DESC
      `, params);

      // Daily profit trend
      const dailyTrend = await dbAll(db, `
        SELECT 
          DATE(s.date) as date,
          SUM(s.gross_profit) as profit,
          SUM(s.quantity * s.unit_price) as sales,
          COUNT(*) as transactions
        FROM sales s
        WHERE 1=1 ${dateFilter}
        GROUP BY DATE(s.date)
        ORDER BY date ASC
      `, params);

      // Overall summary
      const overall = await dbGet(db, `
        SELECT 
          SUM(gross_profit) as total_profit,
          SUM(quantity * unit_price) as total_sales,
          COUNT(*) as total_transactions,
          AVG(gross_profit) as avg_profit_per_sale
        FROM sales s
        WHERE 1=1 ${dateFilter}
      `, params);

      res.json({
        report: 'Profit Analysis Report',
        period: { start_date, end_date },
        generatedAt: new Date().toISOString(),
        overall,
        byBrand,
        byRetailer,
        dailyTrend
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reports/inventory
   * Inventory status report
   */
  router.get('/inventory', authenticate, async (req, res, next) => {
    try {
      const inventory = await dbAll(db, `
        SELECT 
          sk.id,
          sk.name as sku_name,
          b.name as brand_name,
          sk.stock_in_hand,
          sk.purchase_price,
          sk.selling_price,
          (sk.stock_in_hand * sk.purchase_price) as stock_value,
          sk.avg_monthly_sale,
          sk.days_of_inventory,
          sk.status,
          sk.last_sale_date
        FROM skus sk
        JOIN brands b ON sk.brand_id = b.id
        ORDER BY b.name, sk.name
      `, []);

      // Calculate summaries
      const summary = {
        totalSKUs: inventory.length,
        totalStockValue: inventory.reduce((sum, i) => sum + i.stock_value, 0),
        fastMoving: inventory.filter(i => i.status === 'FAST').length,
        slowMoving: inventory.filter(i => i.status === 'SLOW').length,
        deadStock: inventory.filter(i => i.status === 'DEAD').length,
        lowStock: inventory.filter(i => i.stock_in_hand < 10).length,
        outOfStock: inventory.filter(i => i.stock_in_hand === 0).length
      };

      // Group by brand
      const byBrand = {};
      inventory.forEach(item => {
        if (!byBrand[item.brand_name]) {
          byBrand[item.brand_name] = {
            items: [],
            totalValue: 0,
            totalSKUs: 0
          };
        }
        byBrand[item.brand_name].items.push(item);
        byBrand[item.brand_name].totalValue += item.stock_value;
        byBrand[item.brand_name].totalSKUs++;
      });

      res.json({
        report: 'Inventory Status Report',
        generatedAt: new Date().toISOString(),
        summary,
        byBrand,
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reports/credit
   * Credit/Outstanding report
   */
  router.get('/credit', authenticate, async (req, res, next) => {
    try {
      const retailers = await dbAll(db, `
        SELECT 
          r.id,
          r.name,
          r.area,
          r.phone,
          r.credit_limit,
          r.credit_class,
          r.outstanding_amount,
          r.days_outstanding,
          r.credit_frozen,
          (SELECT SUM(quantity * unit_price) FROM sales WHERE retailer_id = r.id AND payment_type = 'credit') as total_credit_sales,
          (SELECT MAX(date) FROM sales WHERE retailer_id = r.id) as last_sale_date,
          (SELECT MAX(payment_date) FROM payments WHERE retailer_id = r.id) as last_payment_date
        FROM retailers r
        WHERE r.outstanding_amount > 0
        ORDER BY r.outstanding_amount DESC
      `, []);

      const summary = {
        totalOutstanding: retailers.reduce((sum, r) => sum + r.outstanding_amount, 0),
        retailersWithDues: retailers.length,
        overdueCount: retailers.filter(r => r.days_outstanding > 30).length,
        frozenAccounts: retailers.filter(r => r.credit_frozen).length,
        criticalDues: retailers.filter(r => r.days_outstanding > 60).length
      };

      // Aging analysis
      const aging = {
        current: retailers.filter(r => r.days_outstanding <= 30).reduce((sum, r) => sum + r.outstanding_amount, 0),
        days30to60: retailers.filter(r => r.days_outstanding > 30 && r.days_outstanding <= 60).reduce((sum, r) => sum + r.outstanding_amount, 0),
        days60to90: retailers.filter(r => r.days_outstanding > 60 && r.days_outstanding <= 90).reduce((sum, r) => sum + r.outstanding_amount, 0),
        over90: retailers.filter(r => r.days_outstanding > 90).reduce((sum, r) => sum + r.outstanding_amount, 0)
      };

      res.json({
        report: 'Credit & Outstanding Report',
        generatedAt: new Date().toISOString(),
        summary,
        aging,
        data: retailers
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reports/retailer/:id
   * Individual retailer report
   */
  router.get('/retailer/:id', authenticate, async (req, res, next) => {
    try {
      const { id } = req.params;
      const { start_date, end_date } = req.query;

      const retailer = await dbGet(db, 'SELECT * FROM retailers WHERE id = ?', [id]);
      if (!retailer.id) {
        return res.status(404).json({ error: 'Retailer not found' });
      }

      let dateFilter = '';
      const params = [id];
      
      if (start_date) {
        dateFilter += ' AND DATE(s.date) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        dateFilter += ' AND DATE(s.date) <= ?';
        params.push(end_date);
      }

      // Sales history
      const sales = await dbAll(db, `
        SELECT 
          s.date,
          sk.name as sku_name,
          b.name as brand_name,
          s.quantity,
          s.unit_price,
          (s.quantity * s.unit_price) as total_amount,
          s.gross_profit,
          s.payment_type
        FROM sales s
        JOIN skus sk ON s.sku_id = sk.id
        JOIN brands b ON sk.brand_id = b.id
        WHERE s.retailer_id = ? ${dateFilter}
        ORDER BY s.date DESC
      `, params);

      // Payment history
      const payments = await dbAll(db, `
        SELECT * FROM payments 
        WHERE retailer_id = ?
        ORDER BY payment_date DESC
        LIMIT 50
      `, [id]);

      // Summary
      const summary = {
        totalPurchases: sales.reduce((sum, s) => sum + s.total_amount, 0),
        totalProfit: sales.reduce((sum, s) => sum + s.gross_profit, 0),
        transactionCount: sales.length,
        avgOrderValue: sales.length > 0 ? sales.reduce((sum, s) => sum + s.total_amount, 0) / sales.length : 0
      };

      res.json({
        report: 'Retailer Report',
        generatedAt: new Date().toISOString(),
        retailer,
        summary,
        sales,
        payments
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/reports/export/:type
   * Export report data for PDF generation (client-side)
   */
  router.get('/export/:type', authenticate, async (req, res, next) => {
    try {
      const { type } = req.params;
      const { start_date, end_date } = req.query;

      let reportData;
      
      switch (type) {
        case 'sales':
          reportData = await generateSalesExport(db, start_date, end_date);
          break;
        case 'inventory':
          reportData = await generateInventoryExport(db);
          break;
        case 'credit':
          reportData = await generateCreditExport(db);
          break;
        case 'profit':
          reportData = await generateProfitExport(db, start_date, end_date);
          break;
        default:
          return res.status(400).json({ error: 'Invalid report type' });
      }

      logActivity(req.user.id, 'EXPORT_REPORT', { type, start_date, end_date });

      res.json({
        exportType: type,
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.username,
        ...reportData
      });
    } catch (error) {
      next(error);
    }
  });

  // Helper function to group data
  function groupByField(data, field) {
    const grouped = {};
    data.forEach(item => {
      const key = item[field];
      if (!grouped[key]) {
        grouped[key] = {
          items: [],
          totalAmount: 0,
          totalProfit: 0,
          totalQuantity: 0
        };
      }
      grouped[key].items.push(item);
      grouped[key].totalAmount += item.total_amount;
      grouped[key].totalProfit += item.gross_profit;
      grouped[key].totalQuantity += item.quantity;
    });
    return grouped;
  }

  // Export generators
  async function generateSalesExport(db, startDate, endDate) {
    let dateFilter = '';
    const params = [];
    
    if (startDate) {
      dateFilter += ' AND DATE(s.date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND DATE(s.date) <= ?';
      params.push(endDate);
    }

    const data = await dbAll(db, `
      SELECT 
        s.date,
        r.name as retailer,
        sk.name as product,
        b.name as brand,
        s.quantity,
        s.unit_price as price,
        (s.quantity * s.unit_price) as amount,
        s.gross_profit as profit,
        s.payment_type as payment
      FROM sales s
      JOIN retailers r ON s.retailer_id = r.id
      JOIN skus sk ON s.sku_id = sk.id
      JOIN brands b ON sk.brand_id = b.id
      WHERE 1=1 ${dateFilter}
      ORDER BY s.date DESC
    `, params);

    return {
      title: 'Sales Report',
      columns: ['Date', 'Retailer', 'Product', 'Brand', 'Qty', 'Price', 'Amount', 'Profit', 'Payment'],
      rows: data.map(d => [d.date, d.retailer, d.product, d.brand, d.quantity, d.price, d.amount, d.profit, d.payment]),
      summary: {
        'Total Sales': data.reduce((s, d) => s + d.amount, 0),
        'Total Profit': data.reduce((s, d) => s + d.profit, 0),
        'Transactions': data.length
      }
    };
  }

  async function generateInventoryExport(db) {
    const data = await dbAll(db, `
      SELECT 
        b.name as brand,
        sk.name as product,
        sk.stock_in_hand as stock,
        sk.purchase_price as cost,
        sk.selling_price as price,
        (sk.stock_in_hand * sk.purchase_price) as value,
        sk.status
      FROM skus sk
      JOIN brands b ON sk.brand_id = b.id
      ORDER BY b.name, sk.name
    `, []);

    return {
      title: 'Inventory Report',
      columns: ['Brand', 'Product', 'Stock', 'Cost', 'Price', 'Value', 'Status'],
      rows: data.map(d => [d.brand, d.product, d.stock, d.cost, d.price, d.value, d.status]),
      summary: {
        'Total SKUs': data.length,
        'Total Stock Value': data.reduce((s, d) => s + d.value, 0),
        'Out of Stock': data.filter(d => d.stock === 0).length
      }
    };
  }

  async function generateCreditExport(db) {
    const data = await dbAll(db, `
      SELECT 
        r.name as retailer,
        r.area,
        r.phone,
        r.credit_limit as credit_limit,
        r.outstanding_amount as outstanding,
        r.days_outstanding as days,
        CASE WHEN r.credit_frozen THEN 'Yes' ELSE 'No' END as frozen
      FROM retailers r
      WHERE r.outstanding_amount > 0
      ORDER BY r.outstanding_amount DESC
    `, []);

    return {
      title: 'Credit Outstanding Report',
      columns: ['Retailer', 'Area', 'Phone', 'Credit Limit', 'Outstanding', 'Days', 'Frozen'],
      rows: data.map(d => [d.retailer, d.area, d.phone, d.credit_limit, d.outstanding, d.days, d.frozen]),
      summary: {
        'Total Outstanding': data.reduce((s, d) => s + d.outstanding, 0),
        'Retailers with Dues': data.length,
        'Overdue (>30 days)': data.filter(d => d.days > 30).length
      }
    };
  }

  async function generateProfitExport(db, startDate, endDate) {
    let dateFilter = '';
    const params = [];
    
    if (startDate) {
      dateFilter += ' AND DATE(s.date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND DATE(s.date) <= ?';
      params.push(endDate);
    }

    const data = await dbAll(db, `
      SELECT 
        b.name as brand,
        SUM(s.quantity * s.unit_price) as sales,
        SUM(s.gross_profit) as profit,
        COUNT(*) as transactions,
        ROUND(SUM(s.gross_profit) * 100.0 / SUM(s.quantity * s.unit_price), 2) as margin
      FROM sales s
      JOIN skus sk ON s.sku_id = sk.id
      JOIN brands b ON sk.brand_id = b.id
      WHERE 1=1 ${dateFilter}
      GROUP BY b.id
      ORDER BY profit DESC
    `, params);

    return {
      title: 'Profit Analysis Report',
      columns: ['Brand', 'Sales', 'Profit', 'Transactions', 'Margin %'],
      rows: data.map(d => [d.brand, d.sales, d.profit, d.transactions, d.margin]),
      summary: {
        'Total Sales': data.reduce((s, d) => s + d.sales, 0),
        'Total Profit': data.reduce((s, d) => s + d.profit, 0),
        'Avg Margin': data.length > 0 ? (data.reduce((s, d) => s + d.margin, 0) / data.length).toFixed(2) + '%' : '0%'
      }
    };
  }

  return router;
};
