/**
 * Two-Factor Authentication (2FA) Middleware
 * Implements TOTP-based 2FA for admin accounts
 */

const crypto = require('crypto');

// TOTP Configuration
const TOTP_CONFIG = {
  digits: 6,
  period: 30,  // seconds
  algorithm: 'sha1',
  secretLength: 20,
  window: 1    // Allow 1 period before/after for clock drift
};

// In-memory storage for 2FA secrets (use database in production)
const twoFactorSecrets = new Map();
const pendingVerifications = new Map();
const backupCodes = new Map();

/**
 * Generate a random secret for TOTP
 */
function generateSecret() {
  return crypto.randomBytes(TOTP_CONFIG.secretLength).toString('base64');
}

/**
 * Generate backup codes for account recovery
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

/**
 * Convert secret to base32 for authenticator apps
 */
function toBase32(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let base32 = '';
  
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substr(i, 5).padEnd(5, '0');
    base32 += alphabet[parseInt(chunk, 2)];
  }
  
  return base32;
}

/**
 * Generate TOTP token
 */
function generateTOTP(secret, time = Date.now()) {
  const counter = Math.floor(time / 1000 / TOTP_CONFIG.period);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  
  const hmac = crypto.createHmac(TOTP_CONFIG.algorithm, Buffer.from(secret, 'base64'));
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1] & 0xf;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, TOTP_CONFIG.digits);
  return otp.toString().padStart(TOTP_CONFIG.digits, '0');
}

/**
 * Verify TOTP token with time window
 */
function verifyTOTP(secret, token, window = TOTP_CONFIG.window) {
  const now = Date.now();
  
  for (let i = -window; i <= window; i++) {
    const time = now + (i * TOTP_CONFIG.period * 1000);
    const expected = generateTOTP(secret, time);
    
    // Constant-time comparison
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Verify backup code
 */
function verifyBackupCode(userId, code) {
  const userCodes = backupCodes.get(userId);
  if (!userCodes) return false;
  
  const codeIndex = userCodes.indexOf(code.toUpperCase());
  if (codeIndex === -1) return false;
  
  // Remove used backup code
  userCodes.splice(codeIndex, 1);
  backupCodes.set(userId, userCodes);
  
  return true;
}

/**
 * Setup 2FA for a user
 */
function setup2FA(userId, username) {
  const secret = generateSecret();
  const codes = generateBackupCodes();
  
  // Store pending setup (not active until verified)
  pendingVerifications.set(userId, {
    secret,
    backupCodes: codes,
    createdAt: Date.now()
  });
  
  // Generate otpauth URL for QR code
  const base32Secret = toBase32(Buffer.from(secret, 'base64'));
  const issuer = 'FMCG-Control-System';
  const otpauthUrl = `otpauth://totp/${issuer}:${username}?secret=${base32Secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  
  return {
    secret: base32Secret,
    otpauthUrl,
    backupCodes: codes,
    qrCodeData: otpauthUrl
  };
}

/**
 * Verify and activate 2FA setup
 */
function verify2FASetup(userId, token) {
  const pending = pendingVerifications.get(userId);
  if (!pending) {
    return { success: false, error: '2FA setup not initiated' };
  }
  
  // Check if setup expired (10 minutes)
  if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
    pendingVerifications.delete(userId);
    return { success: false, error: '2FA setup expired. Please start again.' };
  }
  
  if (!verifyTOTP(pending.secret, token)) {
    return { success: false, error: 'Invalid verification code' };
  }
  
  // Activate 2FA
  twoFactorSecrets.set(userId, pending.secret);
  backupCodes.set(userId, pending.backupCodes);
  pendingVerifications.delete(userId);
  
  return { success: true, message: '2FA enabled successfully' };
}

/**
 * Disable 2FA for a user
 */
function disable2FA(userId) {
  twoFactorSecrets.delete(userId);
  backupCodes.delete(userId);
  pendingVerifications.delete(userId);
  return { success: true };
}

/**
 * Check if user has 2FA enabled
 */
function has2FAEnabled(userId) {
  return twoFactorSecrets.has(userId);
}

/**
 * Verify 2FA token for login
 */
function verify2FAToken(userId, token) {
  const secret = twoFactorSecrets.get(userId);
  if (!secret) {
    return { success: false, error: '2FA not enabled for this user' };
  }
  
  // Try TOTP first
  if (verifyTOTP(secret, token)) {
    return { success: true };
  }
  
  // Try backup code
  if (verifyBackupCode(userId, token)) {
    return { success: true, usedBackupCode: true };
  }
  
  return { success: false, error: 'Invalid 2FA code' };
}

/**
 * 2FA verification middleware
 * Requires 2FA for admin routes
 */
const require2FA = (options = {}) => {
  const { requireForRoles = ['owner', 'admin'] } = options;
  
  return (req, res, next) => {
    // Skip if user doesn't have restricted role
    if (!req.user || !requireForRoles.includes(req.user.role)) {
      return next();
    }
    
    // Skip if 2FA not enabled for user
    if (!has2FAEnabled(req.user.id)) {
      return next();
    }
    
    // Check if session is 2FA verified
    if (req.session && req.session.twoFactorVerified) {
      return next();
    }
    
    // Require 2FA verification
    res.status(403).json({
      error: '2FA verification required',
      requires2FA: true
    });
  };
};

/**
 * Get remaining backup codes count
 */
function getRemainingBackupCodes(userId) {
  const codes = backupCodes.get(userId);
  return codes ? codes.length : 0;
}

/**
 * Regenerate backup codes
 */
function regenerateBackupCodes(userId) {
  if (!has2FAEnabled(userId)) {
    return { success: false, error: '2FA not enabled' };
  }
  
  const newCodes = generateBackupCodes();
  backupCodes.set(userId, newCodes);
  
  return { success: true, backupCodes: newCodes };
}

module.exports = {
  setup2FA,
  verify2FASetup,
  disable2FA,
  has2FAEnabled,
  verify2FAToken,
  require2FA,
  getRemainingBackupCodes,
  regenerateBackupCodes,
  generateTOTP,
  verifyTOTP,
  // Export for testing
  _internal: {
    twoFactorSecrets,
    backupCodes,
    pendingVerifications
  }
};
