/**
 * Insecure Deserialization Protection
 * Prevents RCE through malicious serialized data
 */

/**
 * Safe JSON parse with validation
 * Prevents prototype pollution and validates structure
 */
function safeJsonParse(jsonString, options = {}) {
  const {
    maxDepth = 10,
    maxKeys = 1000,
    maxSize = 1024 * 1024, // 1MB
    allowedKeys = null, // If set, only these keys are allowed
    blockedKeys = ['__proto__', 'constructor', 'prototype']
  } = options;
  
  // Size check
  if (typeof jsonString !== 'string') {
    throw new Error('Input must be a string');
  }
  
  if (jsonString.length > maxSize) {
    throw new Error('JSON too large');
  }
  
  // Check for obvious prototype pollution attempts
  if (jsonString.includes('__proto__') || 
      jsonString.includes('constructor') ||
      jsonString.includes('prototype')) {
    throw new Error('Potentially malicious JSON detected');
  }
  
  // Parse JSON
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid JSON');
  }
  
  // Validate structure
  validateObject(parsed, 0, maxDepth, maxKeys, allowedKeys, blockedKeys);
  
  // Clean the parsed object
  return cleanObject(parsed, blockedKeys);
}

/**
 * Recursively validate object structure
 */
function validateObject(obj, depth, maxDepth, maxKeys, allowedKeys, blockedKeys, keyCount = { count: 0 }) {
  if (depth > maxDepth) {
    throw new Error('JSON nesting too deep');
  }
  
  if (obj === null || typeof obj !== 'object') {
    return;
  }
  
  const keys = Object.keys(obj);
  keyCount.count += keys.length;
  
  if (keyCount.count > maxKeys) {
    throw new Error('Too many keys in JSON');
  }
  
  for (const key of keys) {
    // Check blocked keys
    if (blockedKeys.includes(key)) {
      throw new Error(`Blocked key detected: ${key}`);
    }
    
    // Check allowed keys if specified
    if (allowedKeys && !allowedKeys.includes(key)) {
      throw new Error(`Key not allowed: ${key}`);
    }
    
    // Recursively validate
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      validateObject(obj[key], depth + 1, maxDepth, maxKeys, allowedKeys, blockedKeys, keyCount);
    }
  }
}

/**
 * Clean object by removing dangerous keys
 */
function cleanObject(obj, blockedKeys) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item, blockedKeys));
  }
  
  const cleaned = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (!blockedKeys.includes(key)) {
      cleaned[key] = cleanObject(value, blockedKeys);
    }
  }
  
  return cleaned;
}

/**
 * Validate object against a schema
 */
function validateSchema(obj, schema) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];
    
    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    if (value === undefined || value === null) continue;
    
    // Type check
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
        continue;
      }
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
    }
    
    // Pattern check
    if (rules.pattern && typeof value === 'string') {
      if (!rules.pattern.test(value)) {
        errors.push(`${field} has invalid format`);
      }
    }
    
    // Min/Max for numbers
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
    }
    
    // MinLength/MaxLength for strings
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
    }
    
    // Array validation
    if (rules.type === 'array') {
      if (rules.minItems && value.length < rules.minItems) {
        errors.push(`${field} must have at least ${rules.minItems} items`);
      }
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push(`${field} must have at most ${rules.maxItems} items`);
      }
      
      // Validate array items
      if (rules.items && Array.isArray(value)) {
        value.forEach((item, index) => {
          const itemErrors = validateSchema({ item }, { item: rules.items });
          errors.push(...itemErrors.map(e => e.replace('item', `${field}[${index}]`)));
        });
      }
    }
    
    // Nested object validation
    if (rules.type === 'object' && rules.properties && typeof value === 'object') {
      const nestedErrors = validateSchema(value, rules.properties);
      errors.push(...nestedErrors.map(e => `${field}.${e}`));
    }
  }
  
  return errors;
}

/**
 * Middleware for safe body parsing
 */
function safeBodyParser(options = {}) {
  return (req, res, next) => {
    if (!req.body) return next();
    
    try {
      // If body is already an object (parsed by express.json), validate it
      if (typeof req.body === 'object') {
        req.body = cleanObject(req.body, ['__proto__', 'constructor', 'prototype']);
      }
      next();
    } catch (error) {
      console.warn(`[SECURITY] Deserialization attack blocked from IP: ${req.ip}`);
      res.status(400).json({
        error: 'Invalid request body',
        code: 'DESERIALIZATION_BLOCKED'
      });
    }
  };
}

/**
 * Validate cookie data (cookies can contain serialized data)
 */
function validateCookieData(cookieValue) {
  // Don't try to parse cookies that look like serialized objects
  if (typeof cookieValue !== 'string') return null;
  
  // Check for obvious serialization patterns
  const dangerousPatterns = [
    /\{\s*["']__proto__["']/i,
    /\{\s*["']constructor["']/i,
    /\{\s*["']prototype["']/i,
    /^O:\d+:/,  // PHP serialization
    /rO0AB/,    // Java serialization (base64)
    /gAAAAAB/   // Python pickle (base64)
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(cookieValue)) {
      return null; // Reject suspicious cookie
    }
  }
  
  return cookieValue;
}

/**
 * Schema definitions for common entities
 */
const schemas = {
  login: {
    username: { type: 'string', required: true, minLength: 1, maxLength: 50 },
    password: { type: 'string', required: true, minLength: 1, maxLength: 128 }
  },
  
  retailer: {
    name: { type: 'string', required: true, minLength: 1, maxLength: 200 },
    contact_person: { type: 'string', maxLength: 100 },
    phone: { type: 'string', pattern: /^[\d\s\-+()]{10,20}$/ },
    email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    credit_limit: { type: 'number', min: 0, max: 100000000 },
    category: { type: 'string', enum: ['A', 'B', 'C', 'D'] }
  },
  
  sale: {
    retailer_id: { type: 'number', required: true, min: 1 },
    items: { type: 'array', required: true, minItems: 1, maxItems: 100 },
    payment_type: { type: 'string', enum: ['cash', 'credit', 'partial'] }
  },
  
  payment: {
    retailer_id: { type: 'number', required: true, min: 1 },
    amount: { type: 'number', required: true, min: 0.01, max: 100000000 },
    payment_method: { type: 'string', required: true, enum: ['cash', 'upi', 'bank_transfer', 'cheque'] }
  }
};

module.exports = {
  safeJsonParse,
  validateObject,
  cleanObject,
  validateSchema,
  safeBodyParser,
  validateCookieData,
  schemas
};
