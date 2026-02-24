const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { 
  setup2FA, 
  verify2FASetup, 
  disable2FA, 
  has2FAEnabled, 
  verify2FAToken,
  getRemainingBackupCodes,
  regenerateBackupCodes 
} = require('../middleware/twoFactorAuth');
const { 
  logSecurityEvent, 
  EVENT_TYPES, 
  SEVERITY 
} = require('../middleware/securityNotifications');

module.exports = function(db, sessions, authenticate, logActivity, validators) {
  const router = express.Router();

  // Login - Step 1: Verify credentials
  router.post('/login', validators.login, async (req, res, next) => {
    try {
      const { username, password, twoFactorCode } = req.body;
      const clientIP = req.ip || req.connection.remoteAddress;
      
      db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          // Log failed login attempt
          logSecurityEvent(EVENT_TYPES.FAILED_LOGIN, {
            ip: clientIP,
            username,
            severity: SEVERITY.WARNING,
            details: { reason: 'user_not_found' }
          });
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          // Log failed login attempt
          logSecurityEvent(EVENT_TYPES.FAILED_LOGIN, {
            ip: clientIP,
            username,
            userId: user.id,
            severity: SEVERITY.WARNING,
            details: { reason: 'invalid_password' }
          });
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check if 2FA is enabled for this user
        if (has2FAEnabled(user.id)) {
          if (!twoFactorCode) {
            // Return that 2FA is required
            return res.status(200).json({
              requires2FA: true,
              message: 'Please enter your 2FA code'
            });
          }
          
          // Verify 2FA code
          const twoFactorResult = verify2FAToken(user.id, twoFactorCode);
          if (!twoFactorResult.success) {
            logSecurityEvent(EVENT_TYPES.TWO_FACTOR_FAILURE, {
              ip: clientIP,
              userId: user.id,
              username,
              severity: SEVERITY.WARNING,
              details: { reason: twoFactorResult.error }
            });
            return res.status(401).json({ error: 'Invalid 2FA code' });
          }
          
          if (twoFactorResult.usedBackupCode) {
            // Warn user about backup code usage
            logSecurityEvent(EVENT_TYPES.ADMIN_ACTION, {
              ip: clientIP,
              userId: user.id,
              username,
              severity: SEVERITY.INFO,
              details: { action: 'backup_code_used' }
            });
          }
        }
        
        const token = uuidv4();
        sessions[token] = {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: Date.now(),
          twoFactorVerified: has2FAEnabled(user.id)
        };
        
        logActivity(user.id, 'LOGIN', { username });
        
        // Log successful admin login
        if (user.role === 'owner' || user.role === 'admin') {
          logSecurityEvent(EVENT_TYPES.NEW_ADMIN_LOGIN, {
            ip: clientIP,
            userId: user.id,
            username,
            severity: SEVERITY.INFO,
            details: { role: user.role }
          });
        }
        
        res.json({ 
          token, 
          user: { 
            id: user.id, 
            username: user.username, 
            role: user.role,
            has2FA: has2FAEnabled(user.id)
          } 
        });
      });
    } catch (error) {
      next(error);
    }
  });

  // Setup 2FA - Initiate
  router.post('/2fa/setup', authenticate, (req, res) => {
    try {
      // Only allow for admin/owner roles
      if (req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ error: '2FA is only available for admin accounts' });
      }
      
      if (has2FAEnabled(req.user.id)) {
        return res.status(400).json({ error: '2FA is already enabled' });
      }
      
      const setup = setup2FA(req.user.id, req.user.username);
      
      logSecurityEvent(EVENT_TYPES.ADMIN_ACTION, {
        ip: req.ip,
        userId: req.user.id,
        username: req.user.username,
        severity: SEVERITY.INFO,
        details: { action: '2fa_setup_initiated' }
      });
      
      res.json({
        secret: setup.secret,
        qrCodeUrl: setup.otpauthUrl,
        backupCodes: setup.backupCodes,
        message: 'Scan the QR code with your authenticator app, then verify with a code'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to setup 2FA' });
    }
  });

  // Verify 2FA setup
  router.post('/2fa/verify-setup', authenticate, (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code || code.length !== 6) {
        return res.status(400).json({ error: 'Invalid verification code format' });
      }
      
      const result = verify2FASetup(req.user.id, code);
      
      if (result.success) {
        logSecurityEvent(EVENT_TYPES.ADMIN_ACTION, {
          ip: req.ip,
          userId: req.user.id,
          username: req.user.username,
          severity: SEVERITY.INFO,
          details: { action: '2fa_enabled' }
        });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify 2FA setup' });
    }
  });

  // Disable 2FA
  router.post('/2fa/disable', authenticate, (req, res) => {
    try {
      const { password, code } = req.body;
      
      // Require password confirmation
      db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          return res.status(401).json({ error: 'Invalid password' });
        }
        
        // Verify current 2FA code
        const twoFactorResult = verify2FAToken(req.user.id, code);
        if (!twoFactorResult.success) {
          return res.status(401).json({ error: 'Invalid 2FA code' });
        }
        
        disable2FA(req.user.id);
        
        logSecurityEvent(EVENT_TYPES.ADMIN_ACTION, {
          ip: req.ip,
          userId: req.user.id,
          username: req.user.username,
          severity: SEVERITY.WARNING,
          details: { action: '2fa_disabled' }
        });
        
        res.json({ success: true, message: '2FA has been disabled' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  });

  // Get 2FA status
  router.get('/2fa/status', authenticate, (req, res) => {
    res.json({
      enabled: has2FAEnabled(req.user.id),
      backupCodesRemaining: getRemainingBackupCodes(req.user.id)
    });
  });

  // Regenerate backup codes
  router.post('/2fa/regenerate-backup-codes', authenticate, (req, res) => {
    try {
      const { code } = req.body;
      
      // Verify 2FA code first
      const twoFactorResult = verify2FAToken(req.user.id, code);
      if (!twoFactorResult.success) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
      
      const result = regenerateBackupCodes(req.user.id);
      
      if (result.success) {
        logSecurityEvent(EVENT_TYPES.ADMIN_ACTION, {
          ip: req.ip,
          userId: req.user.id,
          username: req.user.username,
          severity: SEVERITY.INFO,
          details: { action: 'backup_codes_regenerated' }
        });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to regenerate backup codes' });
    }
  });

  // Logout
  router.post('/logout', authenticate, (req, res) => {
    delete sessions[req.headers['authorization']];
    res.json({ success: true });
  });

  // Get current user
  router.get('/me', authenticate, (req, res) => {
    res.json({ 
      user: {
        ...req.user,
        has2FA: has2FAEnabled(req.user.id)
      }
    });
  });

  return router;
};
