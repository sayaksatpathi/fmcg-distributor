/**
 * Timing Attack Protection & Session Security
 * Prevents information leakage through response timing
 */

const crypto = require('crypto');

/**
 * Constant-time string comparison
 * Prevents timing attacks by always taking the same time regardless of match
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - Whether strings match
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  // Use crypto.timingSafeEqual for constant-time comparison
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  // If lengths differ, compare against itself to maintain constant time
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Constant-time buffer comparison
 */
function constantTimeBufferCompare(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }
  
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  
  return crypto.timingSafeEqual(a, b);
}

/**
 * Add random delay to responses (prevents timing analysis)
 * Use sparingly - only on sensitive operations
 */
function randomDelay(minMs = 50, maxMs = 150) {
  return (req, res, next) => {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    setTimeout(next, delay);
  };
}

/**
 * Normalize response time for auth endpoints
 * Always responds in approximately the same time
 */
function normalizedResponseTime(targetMs = 500) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Store original json and send functions
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    const delayedResponse = (sendFn, data) => {
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, targetMs - elapsed);
      
      // Add some randomness to prevent exact timing analysis
      const jitter = Math.floor(Math.random() * 50);
      
      setTimeout(() => sendFn(data), remainingDelay + jitter);
    };
    
    res.json = (data) => delayedResponse(originalJson, data);
    res.send = (data) => delayedResponse(originalSend, data);
    
    next();
  };
}

/**
 * Session regeneration after authentication state change
 * Prevents session fixation attacks
 */
function regenerateSession(sessions, oldToken) {
  // Get existing session data
  const sessionData = sessions.get(oldToken);
  
  if (!sessionData) {
    return null;
  }
  
  // Generate new token
  const newToken = crypto.randomBytes(32).toString('hex');
  
  // Delete old session
  sessions.delete(oldToken);
  
  // Create new session with same data but new token
  sessions.set(newToken, {
    ...sessionData,
    createdAt: Date.now(), // Reset session creation time
    regeneratedFrom: oldToken.substring(0, 8) + '...' // Track for audit
  });
  
  return newToken;
}

/**
 * Secure session creation with all security flags
 */
function createSecureSession(sessions, userData, req) {
  const token = crypto.randomBytes(32).toString('hex');
  
  sessions.set(token, {
    id: userData.id,
    username: userData.username,
    role: userData.role,
    createdAt: Date.now(),
    lastAccess: Date.now(),
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    fingerprint: generateSessionFingerprint(req)
  });
  
  return token;
}

/**
 * Generate session fingerprint for additional validation
 */
function generateSessionFingerprint(req) {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || ''
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Validate session fingerprint (detect session hijacking)
 */
function validateSessionFingerprint(session, req) {
  if (!session.fingerprint) return true; // Legacy session
  
  const currentFingerprint = generateSessionFingerprint(req);
  return constantTimeCompare(session.fingerprint, currentFingerprint);
}

/**
 * Session validation middleware with fingerprint check
 */
function sessionFingerprintGuard(sessions) {
  return (req, res, next) => {
    const token = req.headers['authorization'];
    
    if (!token) return next();
    
    const session = sessions.get(token);
    
    if (session && !validateSessionFingerprint(session, req)) {
      console.warn(`[SECURITY] Session fingerprint mismatch for user ${session.username} from IP ${req.ip}`);
      
      // Possible session hijacking - invalidate session
      sessions.delete(token);
      
      return res.status(401).json({
        error: 'Session invalid. Please login again.',
        code: 'SESSION_FINGERPRINT_MISMATCH'
      });
    }
    
    next();
  };
}

/**
 * Detect concurrent session anomalies
 */
function detectConcurrentSessions(sessions, userId, maxConcurrent = 3) {
  let count = 0;
  const userSessions = [];
  
  for (const [token, session] of sessions.entries()) {
    if (session.id === userId) {
      count++;
      userSessions.push({
        token: token.substring(0, 8) + '...',
        createdAt: session.createdAt,
        ip: session.ip,
        lastAccess: session.lastAccess
      });
    }
  }
  
  return {
    count,
    exceedsLimit: count >= maxConcurrent,
    sessions: userSessions
  };
}

/**
 * Invalidate all sessions for a user (for logout-all feature)
 */
function invalidateAllUserSessions(sessions, userId, exceptToken = null) {
  let invalidated = 0;
  
  for (const [token, session] of sessions.entries()) {
    if (session.id === userId && token !== exceptToken) {
      sessions.delete(token);
      invalidated++;
    }
  }
  
  return invalidated;
}

/**
 * IP change detection (potential session hijacking)
 */
function ipChangeGuard(sessions, options = {}) {
  const { allowIPChange = false, notifyOnChange = true } = options;
  
  return (req, res, next) => {
    const token = req.headers['authorization'];
    
    if (!token) return next();
    
    const session = sessions.get(token);
    
    if (session && session.ip && session.ip !== req.ip) {
      console.warn(`[SECURITY] IP change detected for user ${session.username}: ${session.ip} -> ${req.ip}`);
      
      if (!allowIPChange) {
        sessions.delete(token);
        
        return res.status(401).json({
          error: 'Session invalid due to network change. Please login again.',
          code: 'IP_CHANGE_DETECTED'
        });
      }
      
      // Update IP if allowed
      session.ip = req.ip;
      session.ipChangeCount = (session.ipChangeCount || 0) + 1;
    }
    
    next();
  };
}

module.exports = {
  constantTimeCompare,
  constantTimeBufferCompare,
  randomDelay,
  normalizedResponseTime,
  regenerateSession,
  createSecureSession,
  generateSessionFingerprint,
  validateSessionFingerprint,
  sessionFingerprintGuard,
  detectConcurrentSessions,
  invalidateAllUserSessions,
  ipChangeGuard
};
