/**
 * Security Admin Routes
 * Provides endpoints for security monitoring and management
 */

const express = require('express');
const { 
  getRecentSecurityEvents, 
  getSecurityStats,
  EVENT_TYPES,
  SEVERITY 
} = require('../middleware/securityNotifications');

module.exports = function(db, authenticate) {
  const router = express.Router();

  /**
   * Middleware to require admin role
   */
  const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  /**
   * GET /api/security/events
   * Get recent security events
   */
  router.get('/events', authenticate, requireAdmin, (req, res) => {
    const { limit, severity, type, since } = req.query;
    
    const events = getRecentSecurityEvents({
      limit: parseInt(limit) || 100,
      severity: severity || null,
      type: type || null,
      since: since || null
    });
    
    res.json({
      count: events.length,
      events
    });
  });

  /**
   * GET /api/security/stats
   * Get security statistics
   */
  router.get('/stats', authenticate, requireAdmin, (req, res) => {
    const { timeWindow } = req.query;
    const stats = getSecurityStats(parseInt(timeWindow) || 60);
    
    res.json(stats);
  });

  /**
   * GET /api/security/event-types
   * Get available event types
   */
  router.get('/event-types', authenticate, requireAdmin, (req, res) => {
    res.json({
      eventTypes: Object.keys(EVENT_TYPES),
      severityLevels: Object.keys(SEVERITY)
    });
  });

  /**
   * GET /api/security/dashboard
   * Get security dashboard summary
   */
  router.get('/dashboard', authenticate, requireAdmin, (req, res) => {
    const hourlyStats = getSecurityStats(60);
    const dailyStats = getSecurityStats(1440);
    const recentCritical = getRecentSecurityEvents({
      limit: 10,
      severity: SEVERITY.CRITICAL
    });
    
    res.json({
      hourly: hourlyStats,
      daily: dailyStats,
      recentCriticalEvents: recentCritical,
      summary: {
        criticalEventsLast24h: dailyStats.bySeverity.critical || 0,
        warningEventsLast24h: dailyStats.bySeverity.warning || 0,
        topAttackTypes: Object.entries(dailyStats.byType)
          .filter(([type]) => 
            type.includes('INJECTION') || 
            type.includes('XSS') || 
            type.includes('TRAVERSAL') ||
            type.includes('BRUTE')
          )
          .slice(0, 5)
      }
    });
  });

  return router;
};
