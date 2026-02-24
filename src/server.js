/**
 * FMCG Distributor Control System - FORTRESS SERVER v4.0
 * 
 * COMPLETE SECURITY IMPLEMENTATION
 * ================================
 * 
 * Level 1 - Foundation:
 * ✅ Password Hashing (bcrypt, cost 12)
 * ✅ Input Validation (all endpoints)
 * ✅ SQL Injection Protection (parameterized queries + pattern detection)
 * ✅ HTTPS Ready (secure cookies, HSTS)
 * ✅ Secrets in .env
 * 
 * Level 2 - Defense in Depth:
 * ✅ Rate Limiting (general + auth-specific)
 * ✅ Role-Based Access Control (RBAC)
 * ✅ XSS Protection (sanitization + CSP)
 * ✅ CSRF Protection (origin validation + SameSite)
 * ✅ Secure Cookies (HttpOnly, Secure, SameSite=Strict)
 * ✅ Account Lockout (progressive)
 * 
 * Level 3 - Production Ready:
 * ✅ File Upload Security
 * ✅ Error Handling (generic messages, detailed logs)
 * ✅ Dependency Safety (npm audit)
 * ✅ Database Indexes
 * ✅ Pagination (max 100 items)
 * 
 * Level 4 - Enterprise:
 * ✅ Security Headers (Helmet-like)
 * ✅ CORS Configuration
 * ✅ Monitoring & Audit Logs
 * ✅ Health Checks
 * 
 * ADDITIONAL ATTACK PROTECTIONS:
 * ✅ Clickjacking (X-Frame-Options: DENY)
 * ✅ Open Redirect (URL whitelist)
 * ✅ Path Traversal (path sanitization)
 * ✅ Insecure Deserialization (safe JSON parsing)
 * ✅ IDOR (ownership validation)
 * ✅ Mass Assignment (field whitelisting)
 * ✅ SSRF (IP/hostname blocking)
 * ✅ Session Fixation (token regeneration)
 * ✅ Business Logic Attacks (server-side validation)
 * ✅ Timing Attacks (constant-time comparison)
 * ✅ DDoS Protection (multi-layer defense)
 */

// ============================================
// LOAD ENVIRONMENT FIRST
// ============================================
require('dotenv').config();

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================
const config = require('./config');

// ============================================
// SECURITY MIDDLEWARE IMPORTS
// ============================================

// Core Security
const { securityHeaders } = require('./middleware/security');
const { defaultCors } = require('./middleware/cors');
const { defaultLimiter, authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { defaultLogger } = require('./middleware/logger');
const { errorHandler, notFoundHandler, AppError } = require('./middleware/errorHandler');

// Attack Protection
const { sanitizeAll, sqlInjectionGuard } = require('./middleware/xssProtection');
const { originValidation, sameSiteCookies } = require('./middleware/csrf');
const { accountLockoutGuard, recordFailedAttempt, recordSuccessfulLogin } = require('./middleware/accountLockout');
const { secureCookieMiddleware, generateSecureToken, hashToken } = require('./middleware/secureSession');
const { redirectProtection } = require('./middleware/redirectProtection');
const { pathTraversalGuard } = require('./middleware/pathTraversal');
const { ownershipGuard, checkOwnership } = require('./middleware/idorProtection');
const { stripDangerousFields, getEntityWhitelist, entityWhitelists } = require('./middleware/massAssignment');
const { ssrfProtection } = require('./middleware/ssrfProtection');
const { businessLogicGuard, validateSaleCalculations, commonBusinessRules } = require('./middleware/businessLogic');
const {
  constantTimeCompare,
  normalizedResponseTime,
  regenerateSession,
  createSecureSession,
  sessionFingerprintGuard,
  invalidateAllUserSessions
} = require('./middleware/timingProtection');
const { safeBodyParser, cleanObject } = require('./middleware/deserializationProtection');

// DDoS Protection
const {
  ddosProtection,
  slowlorisProtection,
  userAgentValidation,
  getDDoSStats,
  connectionLimiter
} = require('./middleware/ddosProtection');

// Security Notifications
const {
  securityNotificationMiddleware,
  logSecurityEvent: logSecurityNotification,
  subscribe: subscribeToSecurityEvents,
  EVENT_TYPES,
  SEVERITY
} = require('./middleware/securityNotifications');

// 2FA
const { require2FA } = require('./middleware/twoFactorAuth');

// Validators and Utils
const validators = require('./middleware/validators');
const { paginationMiddleware, executePaginatedQuery } = require('./utils/pagination');
const { applySecurityMigrations, logSecurityEvent, cleanupExpiredData } = require('../scripts/security-migrations');

// Routes
const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const retailerRoutes = require('./routes/retailers');
const brandRoutes = require('./routes/brands');
const skuRoutes = require('./routes/skus');
const salesRoutes = require('./routes/sales');
const creditControlRoutes = require('./routes/credit-control');
const profitRoutes = require('./routes/profit');
const weeklyReviewRoutes = require('./routes/weekly-review');
const productTestRoutes = require('./routes/product-tests');
const importRoutes = require('./routes/import');
const securityRoutes = require('./routes/security');

// ============================================
// EXPRESS APP
// ============================================
const app = express();

// ============================================
// DATABASE CONNECTION
// ============================================
const db = new sqlite3.Database(config.dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');

  // Security: Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Performance: Enable WAL mode
  db.run('PRAGMA journal_mode = WAL');
});

// Initialize database
const initDb = require('../scripts/init-database');
initDb(db, (err) => {
  if (err) {
    console.error('❌ Database initialization error:', err);
  } else {
    console.log('✅ Database tables ready');

    // Apply security migrations
    applySecurityMigrations(db, (err) => {
      if (err) {
        console.error('❌ Security migrations error:', err);
      } else {
        console.log('✅ Security migrations applied');
      }
    });
  }
});

// ============================================
// SESSION MANAGEMENT
// ============================================
const sessions = new Map();

// Session cleanup interval
const sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [token, session] of sessions.entries()) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

// Database cleanup interval
const dbCleanupInterval = setInterval(() => {
  cleanupExpiredData(db);
}, 60 * 60 * 1000);

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Check session expiry
  const now = Date.now();
  if (now - session.createdAt > 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  // Update last access
  session.lastAccess = now;

  req.user = session;
  req.sessionToken = token;
  next();
};

// Role-based access
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logSecurityEvent(db, {
        eventType: 'UNAUTHORIZED_ACCESS',
        userId: req.user?.id,
        username: req.user?.username,
        ipAddress: req.ip,
        success: false,
        details: { requiredRoles: roles, userRole: req.user?.role, path: req.path }
      });
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// Activity logging
const logActivity = (userId, action, details) => {
  db.run(
    'INSERT INTO activity_logs (user_id, action, details, timestamp) VALUES (?, ?, ?, ?)',
    [userId, action, JSON.stringify(details), new Date().toISOString()]
  );
};

// ============================================
// MIDDLEWARE STACK (ORDER MATTERS!)
// ============================================

// 0. DDoS Protection (FIRST LINE OF DEFENSE)
app.use(ddosProtection());
app.use(slowlorisProtection);
app.use(userAgentValidation);

// 1. Security Headers (with CSP nonces)
app.use(securityHeaders());

// 2. Security Event Notifications
app.use(securityNotificationMiddleware);

// 3. Request Logging
app.use(defaultLogger);

// 4. Trust Proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// 5. CORS
app.use(defaultCors);

// 6. General Rate Limiting
app.use(defaultLimiter);

// 7. Secure Cookies
app.use(secureCookieMiddleware());

// 8. Body Parsing with Limits
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 9. Safe Body Parser (Deserialization Protection)
app.use(safeBodyParser());

// 10. Strip Dangerous Fields (Mass Assignment Protection)
app.use(stripDangerousFields());

// 11. Input Sanitization (XSS Protection)
app.use(sanitizeAll());

// 11. SQL Injection Guard
app.use(sqlInjectionGuard());

// 12. Origin Validation (CSRF)
app.use(originValidation({ allowSameOrigin: true }));

// 13. Open Redirect Protection
app.use(redirectProtection());

// 14. Path Traversal Guard
app.use(pathTraversalGuard());

// 15. SSRF Protection
app.use(ssrfProtection());

// 16. Business Logic Guard
app.use(businessLogicGuard());

// 17. Session Fingerprint Guard (Session Hijacking Protection)
app.use(sessionFingerprintGuard(sessions));

// 18. Pagination for API routes
app.use('/api', paginationMiddleware());

// 19. Static Files
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ============================================
// AUTH ROUTES (HIGHLY PROTECTED)
// ============================================

// Strict rate limiting for auth
app.use('/api/login', authLimiter);
app.use('/api/logout', authLimiter);

// Login with timing attack protection
app.post('/api/login',
  normalizedResponseTime(500), // Normalize response time
  accountLockoutGuard(),
  validators.login,
  async (req, res, next) => {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
      db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
          return next(new AppError('Database error', 500));
        }

        // Generic error message (prevents user enumeration)
        const genericError = 'Invalid username or password';

        if (!user) {
          const lockResult = req.recordFailedAttempt();

          logSecurityEvent(db, {
            eventType: 'LOGIN_FAILED',
            username,
            ipAddress: ip,
            userAgent,
            success: false,
            details: { reason: 'user_not_found' }
          });

          if (lockResult.locked) {
            return res.status(429).json({
              error: 'Too many failed attempts. Account temporarily locked.',
              retryAfter: Math.ceil(lockResult.duration / 1000)
            });
          }

          return res.status(401).json({ error: genericError });
        }

        // Constant-time password comparison (prevents timing attacks)
        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
          const lockResult = req.recordFailedAttempt();

          logSecurityEvent(db, {
            eventType: 'LOGIN_FAILED',
            userId: user.id,
            username,
            ipAddress: ip,
            userAgent,
            success: false,
            details: { reason: 'invalid_password' }
          });

          if (lockResult.locked) {
            return res.status(429).json({
              error: 'Too many failed attempts. Account temporarily locked.',
              retryAfter: Math.ceil(lockResult.duration / 1000)
            });
          }

          return res.status(401).json({ error: genericError });
        }

        // === SUCCESSFUL LOGIN ===
        req.recordSuccessfulLogin();

        // Create secure session with fingerprint (prevents session fixation)
        const token = createSecureSession(sessions, user, req);

        // Log successful login
        logSecurityEvent(db, {
          eventType: 'LOGIN_SUCCESS',
          userId: user.id,
          username,
          ipAddress: ip,
          userAgent,
          success: true
        });

        logActivity(user.id, 'LOGIN', { ip });

        res.json({
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role
          }
        });
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout
app.post('/api/logout', authenticate, (req, res) => {
  const token = req.sessionToken;

  if (token) {
    sessions.delete(token);

    logSecurityEvent(db, {
      eventType: 'LOGOUT',
      userId: req.user.id,
      username: req.user.username,
      ipAddress: req.ip,
      success: true
    });
  }

  res.json({ success: true });
});

// Logout all sessions
app.post('/api/logout-all', authenticate, (req, res) => {
  const invalidated = invalidateAllUserSessions(sessions, req.user.id, req.sessionToken);

  logSecurityEvent(db, {
    eventType: 'LOGOUT_ALL',
    userId: req.user.id,
    username: req.user.username,
    ipAddress: req.ip,
    success: true,
    details: { sessionsInvalidated: invalidated }
  });

  res.json({ success: true, sessionsInvalidated: invalidated });
});

// Get current user
app.get('/api/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

// Change password (with session regeneration)
app.post('/api/change-password',
  authenticate,
  validators.passwordStrength,
  async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
      db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) return next(new AppError('Database error', 500));
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Verify current password
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) {
          logSecurityEvent(db, {
            eventType: 'PASSWORD_CHANGE_FAILED',
            userId,
            username: user.username,
            ipAddress: req.ip,
            success: false,
            details: { reason: 'invalid_current_password' }
          });
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password with high cost factor
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
          if (err) return next(new AppError('Failed to update password', 500));

          // Regenerate session (prevents session fixation after password change)
          const newToken = regenerateSession(sessions, req.sessionToken);

          // Invalidate all OTHER sessions
          invalidateAllUserSessions(sessions, userId, newToken);

          logSecurityEvent(db, {
            eventType: 'PASSWORD_CHANGED',
            userId,
            username: user.username,
            ipAddress: req.ip,
            success: true
          });

          logActivity(userId, 'PASSWORD_CHANGED', {});

          res.json({
            success: true,
            message: 'Password changed successfully',
            newToken // Client should update their token
          });
        });
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// API ROUTES
// ============================================

// Health check (no auth)
app.use('/api/health', healthRoutes(db));

// DDoS Stats endpoint (admin only)
app.get('/api/security/ddos-stats', authenticate, requireRole('admin'), (req, res) => {
  res.json(getDDoSStats());
});

// Security monitoring routes (admin only)
app.use('/api/security', securityRoutes(db, authenticate));

// Protected routes
app.use('/api/dashboard', dashboardRoutes(db, authenticate, requireRole, logActivity, validators));
app.use('/api/retailers', retailerRoutes(db, authenticate, requireRole, logActivity, validators));
app.use('/api/brands', brandRoutes(db, authenticate, requireRole, logActivity, validators));
app.use('/api/skus', skuRoutes(db, authenticate, requireRole, logActivity, validators));
app.use('/api/sales',
  validateSaleCalculations(), // Server-side calculation validation
  salesRoutes(db, authenticate, requireRole, logActivity, validators, {
    updateSKUStatuses,
    updateRetailerDaysOutstanding,
    generateAlerts
  })
);
app.use('/api/credit-control', creditControlRoutes(db, authenticate, requireRole, logActivity, validators));
app.use('/api/profit', profitRoutes(db, authenticate, requireRole, logActivity));
app.use('/api/weekly-review', weeklyReviewRoutes(db, authenticate, requireRole, logActivity));
app.use('/api/product-tests', productTestRoutes(db, authenticate, requireRole, logActivity, validators));
app.use('/api/import', importRoutes(db, authenticate, requireRole, logActivity));

// ============================================
// NEW BUSINESS FEATURE ROUTES
// ============================================

// Reports & PDF Export
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes(db, authenticate, requireRole, logActivity));

// Purchase Orders Management
const purchaseOrderRoutes = require('./routes/purchase-orders');
app.use('/api/purchase-orders', purchaseOrderRoutes(db, authenticate, requireRole, logActivity));

// Invoice Generation
const invoiceRoutes = require('./routes/invoices');
app.use('/api/invoices', invoiceRoutes(db, authenticate, requireRole, logActivity));

// Inventory Alerts System
const inventoryAlertRoutes = require('./routes/inventory-alerts');
app.use('/api/inventory-alerts', inventoryAlertRoutes(db, authenticate, requireRole, logActivity));

// Payment Reminders
const paymentReminderRoutes = require('./routes/payment-reminders');
app.use('/api/payment-reminders', paymentReminderRoutes(db, authenticate, requireRole, logActivity));

// Sales Targets Tracking
const salesTargetRoutes = require('./routes/sales-targets');
app.use('/api/sales-targets', salesTargetRoutes(db, authenticate, requireRole, logActivity));

// Returns Management
const returnsRoutes = require('./routes/returns');
app.use('/api/returns', returnsRoutes(db, authenticate, requireRole, logActivity));

// Data Backup & Restore
const backupRoutes = require('./routes/backup');
app.use('/api/backup', backupRoutes(db, authenticate, requireRole, logActivity, config.dbPath));

// WhatsApp Integration
const whatsappRoutes = require('./routes/whatsapp');
app.use('/api/whatsapp', whatsappRoutes(db, authenticate, requireRole, logActivity));

// ============================================
// BACKGROUND TASKS
// ============================================

function updateSKUStatuses() {
  db.all('SELECT * FROM skus', [], (err, skus) => {
    if (err) return;

    skus.forEach(sku => {
      let status = 'SLOW';

      if (sku.last_sale_date) {
        const lastSaleDate = new Date(sku.last_sale_date);
        const daysSinceSale = Math.floor((new Date() - lastSaleDate) / (1000 * 60 * 60 * 24));

        if (daysSinceSale > 45) status = 'DEAD';
        else if (daysSinceSale <= 15) status = 'FAST';
      }

      if (sku.status !== status) {
        db.run('UPDATE skus SET status = ? WHERE id = ?', [status, sku.id]);
      }
    });
  });
}

function updateRetailerDaysOutstanding() {
  db.all(`
    SELECT r.id, r.outstanding_amount,
           COALESCE(MAX(s.date), r.updated_at) as last_credit_date
    FROM retailers r
    LEFT JOIN sales s ON r.id = s.retailer_id AND s.payment_type = 'credit'
    WHERE r.outstanding_amount > 0
    GROUP BY r.id
  `, [], (err, retailers) => {
    if (err) return;

    retailers.forEach(retailer => {
      if (retailer.last_credit_date) {
        const lastCreditDate = new Date(retailer.last_credit_date);
        const daysOutstanding = Math.floor((new Date() - lastCreditDate) / (1000 * 60 * 60 * 24));
        db.run('UPDATE retailers SET days_outstanding = ? WHERE id = ?', [daysOutstanding, retailer.id]);
      }
    });
  });
}

function generateAlerts() {
  // Archive old resolved alerts
  db.run("DELETE FROM alerts WHERE status = 'resolved' AND DATE(created_at) < date('now', '-30 days')");

  // Check for Credit Limit Exceeded
  db.all(`SELECT * FROM retailers WHERE outstanding_amount > credit_limit AND credit_limit > 0`, [], (err, retailers) => {
    if (!err) {
      retailers.forEach(r => {
        // Check if active alert already exists
        db.get(
          "SELECT id FROM alerts WHERE alert_type = 'CREDIT_LIMIT_EXCEEDED' AND entity_type = 'retailer' AND entity_id = ? AND status = 'active'",
          [r.id],
          (err, row) => {
            if (!row) {
              db.run(`
                INSERT INTO alerts (alert_type, severity, message, entity_type, entity_id, status)
                VALUES ('CREDIT_LIMIT_EXCEEDED', 'red', ?, 'retailer', ?, 'active')
              `, [`Retailer ${r.name} exceeded credit limit`, r.id]);
            }
          }
        );
      });
    }
  });

  // Check for Dead SKUs
  db.all(`SELECT * FROM skus WHERE status = 'DEAD' AND stock_in_hand > 0`, [], (err, skus) => {
    if (!err) {
      skus.forEach(s => {
        // Check if active alert already exists
        db.get(
          "SELECT id FROM alerts WHERE alert_type = 'DEAD_SKU' AND entity_type = 'sku' AND entity_id = ? AND status = 'active'",
          [s.id],
          (err, row) => {
            if (!row) {
              db.run(`
                INSERT INTO alerts (alert_type, severity, message, entity_type, entity_id, status)
                VALUES ('DEAD_SKU', 'yellow', ?, 'sku', ?, 'active')
              `, [`SKU ${s.name} is dead with stock ${s.stock_in_hand}`, s.id]);
            }
          }
        );
      });
    }
  });
}

// Function to cleanup duplicate alerts on startup
function cleanupDuplicateAlerts() {
  db.run(`
    DELETE FROM alerts 
    WHERE id NOT IN (
      SELECT MIN(id) 
      FROM alerts 
      WHERE status = 'active' 
      GROUP BY alert_type, entity_type, entity_id
    ) AND status = 'active'
  `, (err) => {
    if (err) console.error('Error cleaning up duplicate alerts:', err);
    else console.log('✅ Cleaned up duplicate alerts');
  });
}

// Background updates
const backgroundUpdateInterval = setInterval(() => {
  updateSKUStatuses();
  updateRetailerDaysOutstanding();
  generateAlerts();
}, 5 * 60 * 1000);

// Initial update & Cleanup
setTimeout(() => {
  cleanupDuplicateAlerts(); // Run cleanup first
  updateSKUStatuses();
  updateRetailerDaysOutstanding();
  generateAlerts();
}, 5000);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

let server;

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');

      clearInterval(sessionCleanupInterval);
      clearInterval(dbCleanupInterval);
      clearInterval(backgroundUpdateInterval);

      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
          process.exit(1);
        }
        console.log('✅ Database connection closed');
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      });
    });

    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  logSecurityEvent(db, {
    eventType: 'UNCAUGHT_EXCEPTION',
    success: false,
    details: { error: err.message, stack: err.stack }
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  logSecurityEvent(db, {
    eventType: 'UNHANDLED_REJECTION',
    success: false,
    details: { reason: String(reason) }
  });
});

// ============================================
// START SERVER
// ============================================

server = app.listen(config.port, () => {
  console.log('');
  console.log('🏰 ═══════════════════════════════════════════════════════════════');
  console.log('      FMCG Distributor Control System - FORTRESS SERVER v4.0');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`   🌐 Server:      http://localhost:${config.port}`);
  console.log(`   🔧 Environment: ${config.nodeEnv}`);
  console.log(`   🗄️  Database:   ${config.dbPath}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('   🔐 SECURITY FEATURES ENABLED:');
  console.log('   ───────────────────────────────────────────────────────────────');
  console.log('   Level 1 (Foundation)');
  console.log('     ✅ Password Hashing (bcrypt)     ✅ Input Validation');
  console.log('     ✅ SQL Injection Protection      ✅ HTTPS Ready');
  console.log('   ───────────────────────────────────────────────────────────────');
  console.log('   Level 2 (Defense in Depth)');
  console.log('     ✅ Rate Limiting                 ✅ RBAC');
  console.log('     ✅ XSS Protection                ✅ CSRF Protection');
  console.log('     ✅ Secure Cookies                ✅ Account Lockout');
  console.log('   ───────────────────────────────────────────────────────────────');
  console.log('   Level 3 (Production Ready)');
  console.log('     ✅ File Upload Security          ✅ Error Handling');
  console.log('     ✅ Database Indexes              ✅ Pagination');
  console.log('   ───────────────────────────────────────────────────────────────');
  console.log('   Level 4 (Enterprise)');
  console.log('     ✅ Security Headers              ✅ CORS Protection');
  console.log('     ✅ Audit Logging                 ✅ Health Checks');
  console.log('   ───────────────────────────────────────────────────────────────');
  console.log('   🛡️ ATTACK PROTECTIONS:');
  console.log('     ✅ Clickjacking                  ✅ Open Redirect');
  console.log('     ✅ Path Traversal                ✅ Deserialization');
  console.log('     ✅ IDOR                          ✅ Mass Assignment');
  console.log('     ✅ SSRF                          ✅ Session Fixation');
  console.log('     ✅ Business Logic                ✅ Timing Attacks');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
});

module.exports = app;
