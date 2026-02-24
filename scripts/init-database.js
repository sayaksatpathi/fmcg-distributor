const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'distributor.db');

function setupTables(db, callback) {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'accountant', 'sales')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Retailers table
    db.run(`CREATE TABLE IF NOT EXISTS retailers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        area TEXT,
        phone TEXT,
        credit_limit REAL DEFAULT 0,
        credit_class TEXT CHECK(credit_class IN ('A', 'B', 'C', 'D')),
        outstanding_amount REAL DEFAULT 0,
        days_outstanding INTEGER DEFAULT 0,
        credit_frozen INTEGER DEFAULT 0,
        monthly_profit REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Brands table
      db.run(`CREATE TABLE IF NOT EXISTS brands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        margin_slab REAL,
        capital_invested REAL DEFAULT 0,
        monthly_profit REAL DEFAULT 0,
        capital_roi REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // SKUs table
      db.run(`CREATE TABLE IF NOT EXISTS skus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand_id INTEGER NOT NULL,
        purchase_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        margin_percent REAL,
        stock_in_hand REAL DEFAULT 0,
        avg_monthly_sale REAL DEFAULT 0,
        days_of_inventory REAL DEFAULT 0,
        status TEXT DEFAULT 'SLOW' CHECK(status IN ('FAST', 'SLOW', 'DEAD')),
        last_sale_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (brand_id) REFERENCES brands(id)
      )`);
      
      // Stock transactions table
      db.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        transaction_type TEXT CHECK(transaction_type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')),
        reference_id INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sku_id) REFERENCES skus(id)
      )`);
      
      // Sales table
      db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date DATE NOT NULL,
        retailer_id INTEGER NOT NULL,
        sku_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        gross_profit REAL NOT NULL,
        payment_type TEXT CHECK(payment_type IN ('cash', 'credit')),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id),
        FOREIGN KEY (sku_id) REFERENCES skus(id)
      )`);
      
      // Payments table
      db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        retailer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id)
      )`);
      
      // Alerts table
      db.run(`CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL,
        severity TEXT CHECK(severity IN ('red', 'yellow')),
        message TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resolved')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Activity logs table
      db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);
      
      // Product tests table
      db.run(`CREATE TABLE IF NOT EXISTS product_tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT NOT NULL,
        batch_size REAL NOT NULL,
        total_cost REAL NOT NULL,
        selling_price REAL NOT NULL,
        expected_margin REAL,
        actual_margin REAL,
        sales_quantity REAL DEFAULT 0,
        sales_revenue REAL DEFAULT 0,
        recommendation TEXT CHECK(recommendation IN ('CONTINUE', 'KILL', NULL)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Purchase Orders table
      db.run(`CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT UNIQUE NOT NULL,
        supplier_name TEXT NOT NULL,
        order_date DATE NOT NULL,
        expected_date DATE,
        total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'partial', 'received', 'cancelled')),
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Purchase Order Items table
      db.run(`CREATE TABLE IF NOT EXISTS purchase_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_id INTEGER NOT NULL,
        sku_id INTEGER NOT NULL,
        quantity_ordered REAL NOT NULL,
        quantity_received REAL DEFAULT 0,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
        FOREIGN KEY (sku_id) REFERENCES skus(id)
      )`);

      // Invoices table
      db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        retailer_id INTEGER NOT NULL,
        sale_id INTEGER,
        invoice_date DATE NOT NULL,
        due_date DATE,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'partial', 'paid', 'cancelled')),
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id),
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Invoice Items table
      db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        sku_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (sku_id) REFERENCES skus(id)
      )`);

      // Payment Reminders table
      db.run(`CREATE TABLE IF NOT EXISTS payment_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        retailer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        due_date DATE NOT NULL,
        days_overdue INTEGER DEFAULT 0,
        reminder_type TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'acknowledged', 'completed', 'cancelled')),
        notes TEXT,
        sent_at DATETIME,
        sent_via TEXT,
        sent_by INTEGER,
        customer_response TEXT,
        promised_date DATE,
        acknowledged_at DATETIME,
        amount_received REAL,
        payment_mode TEXT,
        completed_at DATETIME,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Sales Targets table
      db.run(`CREATE TABLE IF NOT EXISTS sales_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_type TEXT NOT NULL CHECK(target_type IN ('salesperson', 'brand', 'overall', 'region')),
        assigned_to INTEGER,
        brand_id INTEGER,
        target_amount REAL NOT NULL,
        target_quantity REAL,
        achieved_amount REAL DEFAULT 0,
        achieved_quantity REAL DEFAULT 0,
        period TEXT CHECK(period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (brand_id) REFERENCES brands(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Returns table
      db.run(`CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        retailer_id INTEGER NOT NULL,
        sku_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        return_type TEXT NOT NULL CHECK(return_type IN ('damaged', 'expired', 'wrong_product', 'quality_issue', 'customer_return')),
        reason TEXT,
        original_sale_id INTEGER,
        refund_amount REAL,
        action TEXT CHECK(action IN ('refund', 'replace', 'credit_note')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'processed')),
        return_date DATE NOT NULL,
        approval_notes TEXT,
        approved_by INTEGER,
        approved_at DATETIME,
        rejection_reason TEXT,
        rejected_by INTEGER,
        rejected_at DATETIME,
        processed_by INTEGER,
        processed_at DATETIME,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id),
        FOREIGN KEY (sku_id) REFERENCES skus(id),
        FOREIGN KEY (original_sale_id) REFERENCES sales(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Credit Notes table
      db.run(`CREATE TABLE IF NOT EXISTS credit_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        retailer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        return_id INTEGER,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired')),
        used_amount REAL DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id),
        FOREIGN KEY (return_id) REFERENCES returns(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Inventory Adjustments table
      db.run(`CREATE TABLE IF NOT EXISTS inventory_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        adjustment_type TEXT CHECK(adjustment_type IN ('write_off', 'damage', 'correction', 'count')),
        reason TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sku_id) REFERENCES skus(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Backup Logs table
      db.run(`CREATE TABLE IF NOT EXISTS backup_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        file_size INTEGER,
        description TEXT,
        deleted_at DATETIME,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);

      // Settings table
      db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // WhatsApp Logs table
      db.run(`CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT NOT NULL,
        recipient_phone TEXT NOT NULL,
        retailer_id INTEGER,
        reference_id INTEGER,
        reference_type TEXT,
        message_content TEXT,
        status TEXT DEFAULT 'pending',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (retailer_id) REFERENCES retailers(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`);
      
      // Create indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date)');
      db.run('CREATE INDEX IF NOT EXISTS idx_sales_retailer ON sales(retailer_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_sales_sku ON sales(sku_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_skus_brand ON skus(brand_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_stock_sku ON stock_transactions(sku_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_invoices_retailer ON invoices(retailer_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date)');
      db.run('CREATE INDEX IF NOT EXISTS idx_returns_retailer ON returns(retailer_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_returns_sku ON returns(sku_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payment_reminders_retailer ON payment_reminders(retailer_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_sales_targets_assigned ON sales_targets(assigned_to)');

      
      // Create default users
      bcrypt.hash('owner123', 10, (err, ownerHash) => {
        if (err) {
          console.error('Error hashing password:', err);
          if (callback) callback(err);
          return;
        }
        
        db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', 
          ['owner', ownerHash, 'owner'], (err) => {
          if (err) console.error('Error creating owner user:', err);
          
          bcrypt.hash('acc123', 10, (err, accHash) => {
            if (err) {
              console.error('Error hashing password:', err);
              if (callback) callback(err);
              return;
            }
            
            db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', 
              ['accountant', accHash, 'accountant'], (err) => {
              if (err) console.error('Error creating accountant user:', err);
              
              bcrypt.hash('sales123', 10, (err, salesHash) => {
                if (err) {
                  console.error('Error hashing password:', err);
                  if (callback) callback(err);
                  return;
                }
                
                db.run('INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)', 
                  ['sales', salesHash, 'sales'], (err) => {
                  if (err) console.error('Error creating sales user:', err);
                  
                  console.log('Database initialized successfully');
                  if (callback) callback(null);
                });
              });
            });
          });
        });
      });
  });
}

function initDatabase(dbOrCallback, callback) {
  let db = null;
  let cb = callback;
  
  if (typeof dbOrCallback === 'function') {
    // Called as initDatabase(callback) - create new DB
    cb = dbOrCallback;
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        if (cb) cb(err);
        return;
      }
      console.log('Initializing database...');
      setupTables(db, cb);
    });
    return db;
  } else if (dbOrCallback && typeof dbOrCallback.serialize === 'function') {
    // Called as initDatabase(db, callback) - use provided DB
    db = dbOrCallback;
    console.log('Setting up database tables...');
    setupTables(db, cb || (() => {}));
    return db;
  } else {
    throw new Error('Invalid arguments to initDatabase');
  }
}

// If run directly, initialize database
if (require.main === module) {
  initDatabase((err) => {
    if (err) {
      console.error('Database initialization failed:', err);
      process.exit(1);
    } else {
      console.log('Database initialization complete');
      process.exit(0);
    }
  });
}

module.exports = initDatabase;

