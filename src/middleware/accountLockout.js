/**
 * Account Lockout and Brute Force Protection
 * Implements temporary account lockout after failed login attempts
 */

const config = require('../config');

// Store for tracking login attempts
const loginAttempts = new Map();

// Configuration
const LOCKOUT_CONFIG = {
  maxAttempts: 5,              // Max failed attempts before lockout
  lockoutDuration: 15 * 60 * 1000,  // 15 minutes lockout
  attemptWindow: 15 * 60 * 1000,    // 15 minutes window for attempts
  progressiveLockout: true,    // Increase lockout time with each lockout
  maxLockoutDuration: 60 * 60 * 1000 // Max 1 hour lockout
};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > LOCKOUT_CONFIG.attemptWindow * 2) {
      loginAttempts.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Get attempt key for user/IP combination
 */
function getAttemptKey(username, ip) {
  return `${username?.toLowerCase()}:${ip}`;
}

/**
 * Check if account is locked
 */
function isLocked(username, ip) {
  const key = getAttemptKey(username, ip);
  const data = loginAttempts.get(key);
  
  if (!data || !data.lockedUntil) return false;
  
  if (Date.now() < data.lockedUntil) {
    return {
      locked: true,
      remainingTime: Math.ceil((data.lockedUntil - Date.now()) / 1000),
      attempts: data.attempts
    };
  }
  
  // Lockout expired, reset
  data.lockedUntil = null;
  return false;
}

/**
 * Record a failed login attempt
 */
function recordFailedAttempt(username, ip) {
  const key = getAttemptKey(username, ip);
  const now = Date.now();
  
  let data = loginAttempts.get(key);
  
  if (!data) {
    data = {
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
      lockoutCount: 0,
      lockedUntil: null
    };
    loginAttempts.set(key, data);
  }
  
  // Reset if outside attempt window
  if (now - data.firstAttempt > LOCKOUT_CONFIG.attemptWindow) {
    data.attempts = 0;
    data.firstAttempt = now;
  }
  
  data.attempts++;
  data.lastAttempt = now;
  
  // Check if should lock
  if (data.attempts >= LOCKOUT_CONFIG.maxAttempts) {
    data.lockoutCount++;
    
    // Progressive lockout
    let lockoutDuration = LOCKOUT_CONFIG.lockoutDuration;
    if (LOCKOUT_CONFIG.progressiveLockout) {
      lockoutDuration = Math.min(
        lockoutDuration * data.lockoutCount,
        LOCKOUT_CONFIG.maxLockoutDuration
      );
    }
    
    data.lockedUntil = now + lockoutDuration;
    
    console.warn(`Account locked: ${username} from IP ${ip} for ${lockoutDuration / 1000}s`);
    
    return {
      locked: true,
      duration: lockoutDuration,
      attempts: data.attempts
    };
  }
  
  return {
    locked: false,
    attemptsRemaining: LOCKOUT_CONFIG.maxAttempts - data.attempts
  };
}

/**
 * Record a successful login (resets attempts)
 */
function recordSuccessfulLogin(username, ip) {
  const key = getAttemptKey(username, ip);
  loginAttempts.delete(key);
}

/**
 * Get account status
 */
function getAccountStatus(username, ip) {
  const key = getAttemptKey(username, ip);
  const data = loginAttempts.get(key);
  
  if (!data) {
    return {
      locked: false,
      attempts: 0,
      attemptsRemaining: LOCKOUT_CONFIG.maxAttempts
    };
  }
  
  const lockStatus = isLocked(username, ip);
  if (lockStatus && lockStatus.locked) {
    return lockStatus;
  }
  
  return {
    locked: false,
    attempts: data.attempts,
    attemptsRemaining: LOCKOUT_CONFIG.maxAttempts - data.attempts
  };
}

/**
 * Middleware to check account lockout before login
 */
const accountLockoutGuard = () => {
  return (req, res, next) => {
    const { username } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    
    const lockStatus = isLocked(username, ip);
    
    if (lockStatus && lockStatus.locked) {
      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed attempts',
        retryAfter: lockStatus.remainingTime,
        code: 'ACCOUNT_LOCKED'
      });
    }
    
    // Attach helper functions to request
    req.recordFailedAttempt = () => recordFailedAttempt(username, ip);
    req.recordSuccessfulLogin = () => recordSuccessfulLogin(username, ip);
    req.getAccountStatus = () => getAccountStatus(username, ip);
    
    next();
  };
};

/**
 * IP-based rate limiting for additional protection
 */
const ipAttempts = new Map();

const ipBruteForceGuard = (options = {}) => {
  const maxAttempts = options.maxAttempts || 100;
  const windowMs = options.windowMs || 15 * 60 * 1000;
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    let data = ipAttempts.get(ip);
    
    if (!data || now - data.firstAttempt > windowMs) {
      data = { attempts: 1, firstAttempt: now };
      ipAttempts.set(ip, data);
      return next();
    }
    
    data.attempts++;
    
    if (data.attempts > maxAttempts) {
      console.warn(`IP rate limit exceeded: ${ip}`);
      return res.status(429).json({
        error: 'Too many requests from this IP',
        retryAfter: Math.ceil((windowMs - (now - data.firstAttempt)) / 1000),
        code: 'IP_RATE_LIMITED'
      });
    }
    
    next();
  };
};

module.exports = {
  isLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
  getAccountStatus,
  accountLockoutGuard,
  ipBruteForceGuard,
  LOCKOUT_CONFIG
};
