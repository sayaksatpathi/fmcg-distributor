/**
 * Database Security Enhancements
 * Additional indexes and security-related tables
 */

const bcrypt = require('bcryptjs');

/**
 * Apply security-related database migrations
 */
function applySecurityMigrations(db, callback) {
  db.serialize(() => {
    console.log('Applying security migrations...');

    // ============================================
    // ADDITIONAL SECURITY INDEXES
    // ============================================
    
    // Index for faster user lookups (login)
    db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    
    // Index for session lookups
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)');
    
    // Index for payment lookups
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_retailer ON payments(retailer_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)');
    
    // Index for alerts
    db.run('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type)');
    
    // Composite indexes for common queries
    db.run('CREATE INDEX IF NOT EXISTS idx_sales_date_retailer ON sales(date, retailer_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_retailers_outstanding ON retailers(outstanding_amount)');
    db.run('CREATE INDEX IF NOT EXISTS idx_skus_status ON skus(status)');

    // ============================================
    // SECURITY AUDIT TABLE
    // ============================================
    
    db.run(`CREATE TABLE IF NOT EXISTS security_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id INTEGER,
      username TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER DEFAULT 1,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    db.run('CREATE INDEX IF NOT EXISTS idx_security_audit_event ON security_audit(event_type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit(timestamp)');
    db.run('CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit(ip_address)');

    // ============================================
    // FAILED LOGIN ATTEMPTS TABLE
    // ============================================
    
    db.run(`CREATE TABLE IF NOT EXISTS failed_logins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      attempt_count INTEGER DEFAULT 1,
      first_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
      locked_until DATETIME
    )`);
    
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_logins_user_ip ON failed_logins(username, ip_address)');

    // ============================================
    // API RATE LIMITING TABLE
    // ============================================
    
    db.run(`CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      request_count INTEGER DEFAULT 1,
      window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(identifier, endpoint)
    )`);

    // ============================================
    // SESSION MANAGEMENT TABLE
    // ============================================
    
    db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash)');
    db.run('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)');

    // ============================================
    // PASSWORD HISTORY TABLE (prevent reuse)
    // ============================================
    
    db.run(`CREATE TABLE IF NOT EXISTS password_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    
    db.run('CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id)');

    console.log('Security migrations applied successfully');
    
    if (callback) callback(null);
  });
}

/**
 * Log security event to database
 */
function logSecurityEvent(db, event) {
  const {
    eventType,
    userId = null,
    username = null,
    ipAddress = null,
    userAgent = null,
    success = true,
    details = null
  } = event;

  db.run(
    `INSERT INTO security_audit (event_type, user_id, username, ip_address, user_agent, success, details, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventType,
      userId,
      username,
      ipAddress,
      userAgent ? userAgent.substring(0, 500) : null,
      success ? 1 : 0,
      details ? JSON.stringify(details) : null,
      new Date().toISOString()
    ]
  );
}

/**
 * Check if password was used before
 */
async function wasPasswordUsed(db, userId, newPassword, historyCount = 5) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT password_hash FROM password_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [userId, historyCount],
      async (err, rows) => {
        if (err) return reject(err);
        
        for (const row of rows) {
          const match = await bcrypt.compare(newPassword, row.password_hash);
          if (match) return resolve(true);
        }
        
        resolve(false);
      }
    );
  });
}

/**
 * Save password to history
 */
function savePasswordToHistory(db, userId, passwordHash) {
  db.run(
    'INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)',
    [userId, passwordHash]
  );
  
  // Keep only last 10 passwords
  db.run(
    `DELETE FROM password_history 
     WHERE user_id = ? AND id NOT IN (
       SELECT id FROM password_history 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 10
     )`,
    [userId, userId]
  );
}

/**
 * Clean up expired data
 */
function cleanupExpiredData(db) {
  const now = new Date().toISOString();
  
  // Clean expired sessions
  db.run('DELETE FROM user_sessions WHERE expires_at < ? OR revoked = 1', [now]);
  
  // Clean old failed login attempts (older than 24 hours)
  db.run(`DELETE FROM failed_logins WHERE last_attempt < datetime('now', '-24 hours')`);
  
  // Clean old rate limit entries
  db.run(`DELETE FROM rate_limits WHERE window_start < datetime('now', '-1 hour')`);
  
  // Clean old security audit logs (keep 90 days)
  db.run(`DELETE FROM security_audit WHERE timestamp < datetime('now', '-90 days')`);
}

module.exports = {
  applySecurityMigrations,
  logSecurityEvent,
  wasPasswordUsed,
  savePasswordToHistory,
  cleanupExpiredData
};
