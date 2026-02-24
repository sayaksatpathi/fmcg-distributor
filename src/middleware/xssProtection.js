/**
 * XSS Protection and Input Sanitization
 * Protects against Cross-Site Scripting attacks
 */

// HTML entities to escape
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

// Dangerous patterns to detect
const dangerousPatterns = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi
];

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=\/]/g, char => htmlEntities[char]);
}

/**
 * Remove HTML tags
 */
function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Check for dangerous patterns
 */
function hasDangerousContent(str) {
  if (typeof str !== 'string') return false;
  return dangerousPatterns.some(pattern => pattern.test(str));
}

/**
 * Sanitize a string value
 */
function sanitizeString(str, options = {}) {
  if (typeof str !== 'string') return str;
  
  let result = str;
  
  // Trim whitespace
  if (options.trim !== false) {
    result = result.trim();
  }
  
  // Strip HTML tags if requested
  if (options.stripHtml) {
    result = stripHtml(result);
  }
  
  // Escape HTML entities
  if (options.escapeHtml !== false) {
    result = escapeHtml(result);
  }
  
  // Limit length
  if (options.maxLength && result.length > options.maxLength) {
    result = result.substring(0, options.maxLength);
  }
  
  // Remove null bytes
  result = result.replace(/\0/g, '');
  
  return result;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj, options = {}) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too (prevent prototype pollution)
      const safeKey = sanitizeString(key, { escapeHtml: false, maxLength: 100 });
      if (safeKey === '__proto__' || safeKey === 'constructor' || safeKey === 'prototype') {
        continue; // Skip dangerous keys
      }
      sanitized[safeKey] = sanitizeObject(value, options);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Middleware to sanitize request body
 */
const sanitizeBody = (options = {}) => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      // Check for dangerous content
      const bodyString = JSON.stringify(req.body);
      if (hasDangerousContent(bodyString)) {
        return res.status(400).json({ 
          error: 'Request contains potentially dangerous content' 
        });
      }
      
      // Sanitize the body
      req.body = sanitizeObject(req.body, {
        trim: true,
        escapeHtml: false, // Don't escape for storage, escape on output
        stripHtml: options.stripHtml || false,
        maxLength: options.maxLength || 10000
      });
    }
    next();
  };
};

/**
 * Middleware to sanitize query parameters
 */
const sanitizeQuery = (options = {}) => {
  return (req, res, next) => {
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query, {
        trim: true,
        escapeHtml: false,
        maxLength: options.maxLength || 1000
      });
    }
    next();
  };
};

/**
 * Middleware to sanitize URL parameters
 */
const sanitizeParams = (options = {}) => {
  return (req, res, next) => {
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params, {
        trim: true,
        escapeHtml: false,
        maxLength: options.maxLength || 100
      });
    }
    next();
  };
};

/**
 * Combined sanitization middleware
 */
const sanitizeAll = (options = {}) => {
  return (req, res, next) => {
    sanitizeBody(options)(req, res, () => {
      sanitizeQuery(options)(req, res, () => {
        sanitizeParams(options)(req, res, next);
      });
    });
  };
};

/**
 * SQL Injection pattern detection
 */
const sqlInjectionPatterns = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/i,
  /(--)|(\/\*)|(\*\/)/,
  /(;|\||`)/,
  /(\bOR\b|\bAND\b)\s*[\d\w]*\s*=\s*[\d\w]*/i,
  /'\s*(OR|AND)\s*'?\d/i,
  /(\b1\s*=\s*1\b)|(\b0\s*=\s*0\b)/i
];

/**
 * Check for SQL injection attempts
 */
function hasSqlInjection(str) {
  if (typeof str !== 'string') return false;
  return sqlInjectionPatterns.some(pattern => pattern.test(str));
}

/**
 * Middleware to detect SQL injection attempts
 */
const sqlInjectionGuard = () => {
  return (req, res, next) => {
    const checkValue = (value, path) => {
      if (typeof value === 'string' && hasSqlInjection(value)) {
        console.warn(`SQL Injection attempt detected at ${path}:`, value.substring(0, 100));
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          if (checkValue(val, `${path}.${key}`)) return true;
        }
      }
      return false;
    };

    if (checkValue(req.body, 'body') || 
        checkValue(req.query, 'query') || 
        checkValue(req.params, 'params')) {
      return res.status(400).json({ 
        error: 'Invalid request parameters' 
      });
    }

    next();
  };
};

module.exports = {
  escapeHtml,
  stripHtml,
  hasDangerousContent,
  sanitizeString,
  sanitizeObject,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeAll,
  hasSqlInjection,
  sqlInjectionGuard
};
