/**
 * Secure Session and Cookie Management
 * Implements secure session handling with HttpOnly, Secure, and SameSite cookies
 */

const crypto = require('crypto');
const config = require('../config');

// Session configuration
const SESSION_CONFIG = {
  tokenLength: 64,           // Bytes for token generation
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  refreshThreshold: 60 * 60 * 1000, // Refresh if less than 1 hour remaining
  absoluteTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days absolute max
};

/**
 * Generate a cryptographically secure session token
 */
function generateSecureToken(length = SESSION_CONFIG.tokenLength) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage (don't store plain tokens)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Secure session store
 */
class SecureSessionStore {
  constructor() {
    this.sessions = new Map();
    
    // Clean up expired sessions periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Create a new session
   */
  create(userId, userData = {}) {
    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const now = Date.now();
    
    this.sessions.set(tokenHash, {
      userId,
      userData,
      createdAt: now,
      lastAccess: now,
      expiresAt: now + SESSION_CONFIG.maxAge,
      absoluteExpiry: now + SESSION_CONFIG.absoluteTimeout,
      ip: userData.ip || null,
      userAgent: userData.userAgent || null
    });
    
    return token; // Return plain token to client
  }

  /**
   * Validate and get session
   */
  get(token) {
    if (!token) return null;
    
    const tokenHash = hashToken(token);
    const session = this.sessions.get(tokenHash);
    
    if (!session) return null;
    
    const now = Date.now();
    
    // Check expiration
    if (now > session.expiresAt || now > session.absoluteExpiry) {
      this.sessions.delete(tokenHash);
      return null;
    }
    
    // Update last access
    session.lastAccess = now;
    
    // Extend session if approaching expiry (sliding window)
    if (session.expiresAt - now < SESSION_CONFIG.refreshThreshold) {
      session.expiresAt = Math.min(
        now + SESSION_CONFIG.maxAge,
        session.absoluteExpiry
      );
    }
    
    return session;
  }

  /**
   * Update session data
   */
  update(token, userData) {
    if (!token) return false;
    
    const tokenHash = hashToken(token);
    const session = this.sessions.get(tokenHash);
    
    if (!session) return false;
    
    Object.assign(session.userData, userData);
    return true;
  }

  /**
   * Destroy a session
   */
  destroy(token) {
    if (!token) return false;
    
    const tokenHash = hashToken(token);
    return this.sessions.delete(tokenHash);
  }

  /**
   * Destroy all sessions for a user
   */
  destroyAllForUser(userId) {
    let count = 0;
    for (const [hash, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(hash);
        count++;
      }
    }
    return count;
  }

  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    for (const [hash, session] of this.sessions.entries()) {
      if (now > session.expiresAt || now > session.absoluteExpiry) {
        this.sessions.delete(hash);
      }
    }
  }

  /**
   * Get active session count for a user
   */
  getActiveSessionCount(userId) {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId) count++;
    }
    return count;
  }
}

/**
 * Set secure cookie options
 */
function getSecureCookieOptions(options = {}) {
  const isProduction = config.nodeEnv === 'production';
  
  return {
    httpOnly: true,                    // Prevent XSS access
    secure: isProduction,              // HTTPS only in production
    sameSite: 'Strict',                // CSRF protection
    maxAge: options.maxAge || SESSION_CONFIG.maxAge,
    path: options.path || '/',
    domain: options.domain || undefined
  };
}

/**
 * Middleware to set secure cookie defaults
 */
const secureCookieMiddleware = () => {
  return (req, res, next) => {
    // Store original cookie method
    const originalCookie = res.cookie.bind(res);
    
    // Override to enforce security
    res.cookie = (name, value, options = {}) => {
      const secureOptions = {
        ...getSecureCookieOptions(),
        ...options,
        // Always enforce these in production
        httpOnly: config.nodeEnv === 'production' ? true : (options.httpOnly ?? true),
        secure: config.nodeEnv === 'production' ? true : options.secure,
        sameSite: options.sameSite || 'Strict'
      };
      
      return originalCookie(name, value, secureOptions);
    };

    // Add secure clearCookie
    const originalClearCookie = res.clearCookie.bind(res);
    res.clearCookie = (name, options = {}) => {
      return originalClearCookie(name, {
        ...getSecureCookieOptions(),
        ...options
      });
    };
    
    next();
  };
};

/**
 * Session validation middleware
 */
const validateSession = (sessionStore) => {
  return (req, res, next) => {
    const token = req.headers['authorization'] || req.cookies?.session;
    
    if (!token) {
      req.session = null;
      return next();
    }
    
    const session = sessionStore.get(token);
    
    if (!session) {
      req.session = null;
      // Clear invalid cookie
      res.clearCookie('session');
      return next();
    }
    
    // Optional: Validate IP hasn't changed (prevent session hijacking)
    const currentIp = req.ip || req.connection.remoteAddress;
    if (session.ip && session.ip !== currentIp) {
      console.warn(`Session IP mismatch: expected ${session.ip}, got ${currentIp}`);
      // You can choose to invalidate or just log
      // sessionStore.destroy(token);
      // return res.status(401).json({ error: 'Session invalid' });
    }
    
    req.session = session;
    req.sessionToken = token;
    
    next();
  };
};

// Create singleton instance
const sessionStore = new SecureSessionStore();

module.exports = {
  generateSecureToken,
  hashToken,
  SecureSessionStore,
  sessionStore,
  getSecureCookieOptions,
  secureCookieMiddleware,
  validateSession,
  SESSION_CONFIG
};
