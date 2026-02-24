/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

const crypto = require('crypto');

// Token storage (in production, use Redis or database)
const csrfTokens = new Map();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.createdAt > 3600000) { // 1 hour expiry
      csrfTokens.delete(token);
    }
  }
}, 300000); // Clean every 5 minutes

/**
 * Generate a CSRF token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token
 */
function validateToken(token, sessionId) {
  if (!token || !sessionId) return false;
  
  const stored = csrfTokens.get(token);
  if (!stored) return false;
  
  // Check if token belongs to this session
  if (stored.sessionId !== sessionId) return false;
  
  // Check if token is expired (1 hour)
  if (Date.now() - stored.createdAt > 3600000) {
    csrfTokens.delete(token);
    return false;
  }
  
  return true;
}

/**
 * CSRF Protection middleware
 */
const csrfProtection = (options = {}) => {
  const ignoreMethods = options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'];
  const tokenHeader = options.tokenHeader || 'x-csrf-token';
  const cookieName = options.cookieName || '_csrf';
  
  return (req, res, next) => {
    // Get session ID from auth token
    const sessionId = req.headers['authorization'] || req.cookies?.[cookieName] || 'anonymous';
    
    // Generate new token for GET requests
    if (req.method === 'GET') {
      const token = generateToken();
      csrfTokens.set(token, {
        sessionId,
        createdAt: Date.now()
      });
      
      // Set token in response header and cookie
      res.setHeader('X-CSRF-Token', token);
      
      // Also make it available to the request for templates
      req.csrfToken = () => token;
    }
    
    // Skip validation for safe methods
    if (ignoreMethods.includes(req.method)) {
      return next();
    }
    
    // Get token from header, body, or query
    const token = req.headers[tokenHeader] || 
                  req.body?._csrf || 
                  req.query?._csrf;
    
    // Validate token
    if (!validateToken(token, sessionId)) {
      return res.status(403).json({ 
        error: 'Invalid or missing CSRF token',
        code: 'CSRF_ERROR'
      });
    }
    
    // Delete used token (single use)
    if (options.singleUse !== false) {
      csrfTokens.delete(token);
    }
    
    next();
  };
};

/**
 * Origin validation middleware
 * Validates Origin and Referer headers
 */
const originValidation = (options = {}) => {
  const allowedOrigins = options.allowedOrigins || [];
  const allowSameOrigin = options.allowSameOrigin !== false;
  
  return (req, res, next) => {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host;
    
    // If no origin header, check referer
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    
    // Allow same-origin requests
    if (allowSameOrigin && requestOrigin) {
      const hostOrigin = `${req.protocol}://${host}`;
      if (requestOrigin === hostOrigin || 
          requestOrigin === `http://${host}` || 
          requestOrigin === `https://${host}`) {
        return next();
      }
    }
    
    // Check against allowed origins
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return next();
    }
    
    // Allow requests without origin (direct API calls, curl, etc.)
    if (!origin && !referer) {
      return next();
    }
    
    // Block suspicious requests
    if (options.strict && requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      console.warn(`Blocked request from origin: ${requestOrigin}`);
      return res.status(403).json({ 
        error: 'Request origin not allowed',
        code: 'ORIGIN_ERROR'
      });
    }
    
    next();
  };
};

/**
 * SameSite cookie enforcement
 */
const sameSiteCookies = (options = {}) => {
  const sameSite = options.sameSite || 'Strict';
  const secure = options.secure !== false;
  const httpOnly = options.httpOnly !== false;
  
  return (req, res, next) => {
    // Override res.cookie to enforce security
    const originalCookie = res.cookie.bind(res);
    
    res.cookie = (name, value, opts = {}) => {
      const secureOpts = {
        ...opts,
        sameSite: opts.sameSite || sameSite,
        httpOnly: opts.httpOnly !== undefined ? opts.httpOnly : httpOnly,
        secure: process.env.NODE_ENV === 'production' ? true : (opts.secure || false)
      };
      
      return originalCookie(name, value, secureOpts);
    };
    
    next();
  };
};

module.exports = {
  generateToken,
  validateToken,
  csrfProtection,
  originValidation,
  sameSiteCookies
};
