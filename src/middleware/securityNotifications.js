/**
 * Security Event Notifications
 * Monitors and alerts on suspicious security events
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const NOTIFICATION_CONFIG = {
  logPath: path.join(__dirname, '..', 'logs', 'security-events.log'),
  alertThresholds: {
    failedLogins: 5,          // Per IP in 15 minutes
    rateLimitHits: 10,        // Per IP in 5 minutes
    suspiciousPatterns: 3,    // SQL injection, XSS attempts
    accountLockouts: 1,       // Immediate alert
    privilegedActions: 1      // Admin actions logged immediately
  },
  retentionDays: 90
};

// In-memory event tracking
const eventTrackers = {
  failedLogins: new Map(),      // IP -> [{timestamp, username}]
  rateLimitHits: new Map(),     // IP -> [timestamp]
  suspiciousPatterns: new Map(), // IP -> [{timestamp, type, details}]
  notifications: []              // Recent notifications queue
};

// Notification subscribers (webhooks, email handlers, etc.)
const subscribers = [];

/**
 * Event severity levels
 */
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  ALERT: 'alert'
};

/**
 * Security event types
 */
const EVENT_TYPES = {
  FAILED_LOGIN: 'FAILED_LOGIN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  PATH_TRAVERSAL_ATTEMPT: 'PATH_TRAVERSAL_ATTEMPT',
  SUSPICIOUS_USER_AGENT: 'SUSPICIOUS_USER_AGENT',
  BRUTE_FORCE_DETECTED: 'BRUTE_FORCE_DETECTED',
  PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  SESSION_HIJACK_ATTEMPT: 'SESSION_HIJACK_ATTEMPT',
  DDOS_DETECTED: 'DDOS_DETECTED',
  IP_BANNED: 'IP_BANNED',
  TWO_FACTOR_FAILURE: 'TWO_FACTOR_FAILURE',
  ADMIN_ACTION: 'ADMIN_ACTION',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  NEW_ADMIN_LOGIN: 'NEW_ADMIN_LOGIN'
};

/**
 * Ensure log directory exists
 */
function ensureLogDirectory() {
  const logDir = path.dirname(NOTIFICATION_CONFIG.logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Generate unique event ID
 */
function generateEventId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Format security event for logging
 */
function formatSecurityEvent(event) {
  return JSON.stringify({
    id: event.id,
    timestamp: event.timestamp,
    type: event.type,
    severity: event.severity,
    ip: event.ip,
    userId: event.userId,
    username: event.username,
    details: event.details,
    userAgent: event.userAgent,
    path: event.path
  });
}

/**
 * Write event to log file
 */
function writeToLog(event) {
  ensureLogDirectory();
  const logLine = formatSecurityEvent(event) + '\n';
  fs.appendFile(NOTIFICATION_CONFIG.logPath, logLine, (err) => {
    if (err) console.error('Failed to write security log:', err);
  });
}

/**
 * Notify all subscribers
 */
async function notifySubscribers(event) {
  for (const subscriber of subscribers) {
    try {
      await subscriber(event);
    } catch (err) {
      console.error('Notification subscriber error:', err);
    }
  }
}

/**
 * Log security event and check thresholds
 */
function logSecurityEvent(type, data = {}) {
  const event = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    type,
    severity: data.severity || SEVERITY.WARNING,
    ip: data.ip || 'unknown',
    userId: data.userId || null,
    username: data.username || null,
    details: data.details || {},
    userAgent: data.userAgent || null,
    path: data.path || null
  };

  // Write to log file
  writeToLog(event);

  // Track and check thresholds
  checkThresholdsAndAlert(event);

  // Add to recent notifications
  eventTrackers.notifications.unshift(event);
  if (eventTrackers.notifications.length > 1000) {
    eventTrackers.notifications.pop();
  }

  // Notify subscribers for critical events
  if (event.severity === SEVERITY.CRITICAL || event.severity === SEVERITY.ALERT) {
    notifySubscribers(event);
  }

  return event;
}

/**
 * Check thresholds and trigger alerts
 */
function checkThresholdsAndAlert(event) {
  const ip = event.ip;
  const now = Date.now();
  const fifteenMinutesAgo = now - 15 * 60 * 1000;
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  switch (event.type) {
    case EVENT_TYPES.FAILED_LOGIN:
      trackEvent(eventTrackers.failedLogins, ip, {
        timestamp: now,
        username: event.username
      });
      
      const recentFailures = getRecentEvents(eventTrackers.failedLogins, ip, fifteenMinutesAgo);
      if (recentFailures.length >= NOTIFICATION_CONFIG.alertThresholds.failedLogins) {
        triggerAlert({
          type: EVENT_TYPES.BRUTE_FORCE_DETECTED,
          severity: SEVERITY.CRITICAL,
          ip,
          details: {
            failedAttempts: recentFailures.length,
            targetedUsernames: [...new Set(recentFailures.map(f => f.username))]
          }
        });
      }
      break;

    case EVENT_TYPES.RATE_LIMIT_EXCEEDED:
      trackEvent(eventTrackers.rateLimitHits, ip, now);
      
      const recentRateLimits = getRecentEvents(eventTrackers.rateLimitHits, ip, fiveMinutesAgo);
      if (recentRateLimits.length >= NOTIFICATION_CONFIG.alertThresholds.rateLimitHits) {
        triggerAlert({
          type: EVENT_TYPES.DDOS_DETECTED,
          severity: SEVERITY.ALERT,
          ip,
          details: {
            rateLimitHits: recentRateLimits.length,
            timeWindow: '5 minutes'
          }
        });
      }
      break;

    case EVENT_TYPES.SQL_INJECTION_ATTEMPT:
    case EVENT_TYPES.XSS_ATTEMPT:
    case EVENT_TYPES.PATH_TRAVERSAL_ATTEMPT:
      trackEvent(eventTrackers.suspiciousPatterns, ip, {
        timestamp: now,
        type: event.type,
        details: event.details
      });
      
      const suspiciousEvents = getRecentEvents(eventTrackers.suspiciousPatterns, ip, fifteenMinutesAgo);
      if (suspiciousEvents.length >= NOTIFICATION_CONFIG.alertThresholds.suspiciousPatterns) {
        triggerAlert({
          type: 'ATTACK_PATTERN_DETECTED',
          severity: SEVERITY.CRITICAL,
          ip,
          details: {
            attackTypes: [...new Set(suspiciousEvents.map(s => s.type))],
            attemptCount: suspiciousEvents.length
          }
        });
      }
      break;

    case EVENT_TYPES.ACCOUNT_LOCKED:
      triggerAlert({
        type: EVENT_TYPES.ACCOUNT_LOCKED,
        severity: SEVERITY.CRITICAL,
        ip,
        details: event.details
      });
      break;
  }
}

/**
 * Track event in memory
 */
function trackEvent(tracker, key, value) {
  if (!tracker.has(key)) {
    tracker.set(key, []);
  }
  tracker.get(key).push(value);
  
  // Cleanup old entries (keep last hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const events = tracker.get(key);
  const filtered = events.filter(e => {
    const timestamp = typeof e === 'object' ? e.timestamp : e;
    return timestamp > oneHourAgo;
  });
  tracker.set(key, filtered);
}

/**
 * Get recent events from tracker
 */
function getRecentEvents(tracker, key, since) {
  const events = tracker.get(key) || [];
  return events.filter(e => {
    const timestamp = typeof e === 'object' ? e.timestamp : e;
    return timestamp > since;
  });
}

/**
 * Trigger an alert
 */
function triggerAlert(alertData) {
  const alert = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    ...alertData
  };

  console.log('\n🚨 SECURITY ALERT 🚨');
  console.log('==================');
  console.log(`Type: ${alert.type}`);
  console.log(`Severity: ${alert.severity.toUpperCase()}`);
  console.log(`IP: ${alert.ip}`);
  console.log(`Details: ${JSON.stringify(alert.details, null, 2)}`);
  console.log('==================\n');

  // Log the alert
  writeToLog(alert);

  // Notify subscribers
  notifySubscribers(alert);

  return alert;
}

/**
 * Subscribe to security notifications
 */
function subscribe(handler) {
  if (typeof handler === 'function') {
    subscribers.push(handler);
    return () => {
      const index = subscribers.indexOf(handler);
      if (index > -1) subscribers.splice(index, 1);
    };
  }
}

/**
 * Format an HTML email body for a security event.
 */
function formatEmailBody(event) {
  const rows = Object.entries({
    Type: event.type,
    Severity: (event.severity || '').toUpperCase(),
    IP: event.ip || 'unknown',
    User: event.username || event.userId || '—',
    Path: event.path || '—',
    Time: event.timestamp,
  })
    .map(([k, v]) => `<tr><td style="padding:4px 12px;font-weight:600">${k}</td><td style="padding:4px 12px">${v}</td></tr>`)
    .join('');
  return `
    <h2 style="color:#b91c1c">🚨 Security Alert: ${event.type}</h2>
    <table style="border-collapse:collapse;font-family:sans-serif">${rows}</table>
    <pre style="background:#f4f4f5;padding:12px;border-radius:6px">${JSON.stringify(event.details || {}, null, 2)}</pre>`;
}

/**
 * Email notification handler.
 *
 * Sends via nodemailer when SMTP config is provided (config.smtp or SMTP_* env).
 * If nodemailer is unavailable or SMTP is not configured, it logs and no-ops
 * safely rather than throwing.
 *
 * config: { to, from, smtp }  (smtp falls back to env SMTP_HOST/PORT/USER/PASS)
 */
function createEmailNotifier(config = {}) {
  const to = config.to || process.env.SECURITY_ALERT_EMAIL_TO;
  const from = config.from || process.env.SECURITY_ALERT_EMAIL_FROM || 'security@fmcg-distributor';
  const smtp = config.smtp || (process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      }
    : null);

  let transporter = null;
  if (smtp && to) {
    try {
      // Lazy require so the module loads even when nodemailer isn't installed.
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport(smtp);
    } catch (err) {
      console.warn('[EMAIL] nodemailer unavailable — email alerts disabled:', err.message);
    }
  }

  return async (event) => {
    if (!transporter || !to) {
      console.warn(`[EMAIL] Not configured — skipped alert ${event.type} (${event.severity}).`);
      return;
    }
    try {
      await transporter.sendMail({
        from,
        to,
        subject: `Security Alert: ${event.type} [${(event.severity || '').toUpperCase()}]`,
        html: formatEmailBody(event),
      });
    } catch (err) {
      console.error('[EMAIL] Failed to send security alert:', err.message);
    }
  };
}

/**
 * Slack webhook notification handler.
 *
 * Posts a formatted message to an incoming webhook. The URL may be passed in or
 * taken from SLACK_SECURITY_WEBHOOK_URL. No-ops safely when not configured.
 */
function createSlackNotifier(webhookUrl) {
  const url = webhookUrl || process.env.SLACK_SECURITY_WEBHOOK_URL;
  return async (event) => {
    if (!url) {
      console.warn(`[SLACK] No webhook configured — skipped alert ${event.type} (${event.severity}).`);
      return;
    }
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Security Alert: ${event.type}`,
          attachments: [
            {
              color: event.severity === SEVERITY.CRITICAL || event.severity === SEVERITY.ALERT
                ? 'danger'
                : 'warning',
              fields: [
                { title: 'Severity', value: (event.severity || '').toUpperCase(), short: true },
                { title: 'IP', value: event.ip || 'unknown', short: true },
                { title: 'User', value: event.username || event.userId || '—', short: true },
                { title: 'Path', value: event.path || '—', short: true },
                { title: 'Time', value: event.timestamp, short: false },
              ],
            },
          ],
        }),
      });
      if (!resp.ok) {
        console.error(`[SLACK] Webhook responded ${resp.status}`);
      }
    } catch (err) {
      console.error('[SLACK] Failed to post security alert:', err.message);
    }
  };
}

/**
 * Get security events for admin dashboard
 */
function getRecentSecurityEvents(options = {}) {
  const { limit = 100, severity = null, type = null, since = null } = options;
  
  let events = [...eventTrackers.notifications];
  
  if (severity) {
    events = events.filter(e => e.severity === severity);
  }
  
  if (type) {
    events = events.filter(e => e.type === type);
  }
  
  if (since) {
    const sinceDate = new Date(since);
    events = events.filter(e => new Date(e.timestamp) > sinceDate);
  }
  
  return events.slice(0, limit);
}

/**
 * Get security statistics
 */
function getSecurityStats(timeWindowMinutes = 60) {
  const since = Date.now() - timeWindowMinutes * 60 * 1000;
  const events = eventTrackers.notifications.filter(
    e => new Date(e.timestamp).getTime() > since
  );

  const stats = {
    totalEvents: events.length,
    bySeverity: {},
    byType: {},
    topIPs: {},
    timeWindow: `${timeWindowMinutes} minutes`
  };

  for (const event of events) {
    // By severity
    stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;
    
    // By type
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    
    // Top IPs
    if (event.ip) {
      stats.topIPs[event.ip] = (stats.topIPs[event.ip] || 0) + 1;
    }
  }

  // Sort top IPs
  stats.topIPs = Object.entries(stats.topIPs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [ip, count]) => ({ ...obj, [ip]: count }), {});

  return stats;
}

/**
 * Security notification middleware
 */
const securityNotificationMiddleware = (req, res, next) => {
  // Attach logger to request for use in other middleware
  req.logSecurityEvent = (type, details = {}) => {
    logSecurityEvent(type, {
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      username: req.user?.username,
      userAgent: req.headers['user-agent'],
      path: req.path,
      ...details
    });
  };
  
  next();
};

/**
 * Cleanup old log entries
 */
function cleanupOldLogs() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_CONFIG.retentionDays);
  
  // In production, implement log rotation
  console.log(`[Security] Log cleanup would remove entries before ${cutoffDate.toISOString()}`);
}

// Schedule daily cleanup
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
  logSecurityEvent,
  subscribe,
  createEmailNotifier,
  createSlackNotifier,
  getRecentSecurityEvents,
  getSecurityStats,
  securityNotificationMiddleware,
  triggerAlert,
  SEVERITY,
  EVENT_TYPES,
  NOTIFICATION_CONFIG
};
