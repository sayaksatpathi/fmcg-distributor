/**
 * Mass Assignment Protection
 * Prevents attackers from injecting unauthorized fields into requests
 */

/**
 * Create a field whitelist filter
 * Only allows specified fields through, blocks all others
 * 
 * @param {string[]} allowedFields - Array of allowed field names
 * @param {Object} options - Configuration options
 */
function fieldWhitelist(allowedFields, options = {}) {
  const {
    strict = true, // If true, removes unknown fields; if false, throws error
    logBlocked = true,
    nestedFields = {} // { 'address': ['street', 'city', 'zip'] }
  } = options;
  
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }
    
    const blockedFields = [];
    const cleanBody = {};
    
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedFields.includes(key)) {
        // Check nested fields if applicable
        if (nestedFields[key] && typeof value === 'object' && !Array.isArray(value)) {
          cleanBody[key] = {};
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (nestedFields[key].includes(nestedKey)) {
              cleanBody[key][nestedKey] = nestedValue;
            } else {
              blockedFields.push(`${key}.${nestedKey}`);
            }
          }
        } else {
          cleanBody[key] = value;
        }
      } else {
        blockedFields.push(key);
      }
    }
    
    if (blockedFields.length > 0) {
      if (logBlocked) {
        console.warn(`[SECURITY] Mass assignment blocked fields: ${blockedFields.join(', ')} from IP: ${req.ip}`);
      }
      
      if (!strict) {
        return res.status(400).json({
          error: 'Invalid fields in request',
          code: 'MASS_ASSIGNMENT_BLOCKED',
          blockedFields
        });
      }
    }
    
    req.body = cleanBody;
    next();
  };
}

/**
 * Dangerous fields that should NEVER be accepted from user input
 */
const DANGEROUS_FIELDS = [
  'role',
  'isAdmin',
  'is_admin',
  'admin',
  'permissions',
  'privilege',
  'privileges',
  'access_level',
  'accessLevel',
  'user_type',
  'userType',
  'verified',
  'is_verified',
  'isVerified',
  'email_verified',
  'emailVerified',
  'password_hash',
  'passwordHash',
  'password_reset_token',
  'api_key',
  'apiKey',
  'secret',
  'token',
  'refresh_token',
  'refreshToken',
  'session',
  'session_id',
  'sessionId',
  '__proto__',
  'constructor',
  'prototype'
];

/**
 * Strip dangerous fields from request body
 * Use as a safety net middleware
 */
function stripDangerousFields() {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const blockedFields = [];
      
      for (const field of DANGEROUS_FIELDS) {
        if (field in req.body) {
          blockedFields.push(field);
          delete req.body[field];
        }
      }
      
      // Also check nested objects (one level deep)
      for (const [key, value] of Object.entries(req.body)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const field of DANGEROUS_FIELDS) {
            if (field in value) {
              blockedFields.push(`${key}.${field}`);
              delete value[field];
            }
          }
        }
      }
      
      if (blockedFields.length > 0) {
        console.warn(`[SECURITY] Stripped dangerous fields: ${blockedFields.join(', ')} from IP: ${req.ip}`);
      }
    }
    
    next();
  };
}

/**
 * Create entity-specific validators
 */
const entityWhitelists = {
  // Retailer creation/update
  retailer: ['name', 'contact_person', 'phone', 'email', 'address', 'town', 
             'credit_limit', 'category', 'notes', 'latitude', 'longitude'],
  
  // Brand creation/update
  brand: ['name', 'company', 'category', 'description', 'is_active'],
  
  // SKU creation/update
  sku: ['name', 'brand_id', 'mrp', 'purchase_price', 'selling_price', 
        'unit', 'pack_size', 'description', 'is_active'],
  
  // Sale creation
  sale: ['retailer_id', 'items', 'payment_type', 'amount_paid', 'notes', 'date'],
  
  // Sale item
  saleItem: ['sku_id', 'quantity', 'price', 'discount'],
  
  // Payment
  payment: ['retailer_id', 'amount', 'payment_method', 'reference', 'notes', 'date'],
  
  // Product test
  productTest: ['sku_id', 'retailer_id', 'quantity', 'test_date', 'follow_up_date', 
                'status', 'feedback', 'notes'],
  
  // User profile update (not role!)
  userProfile: ['username', 'email', 'full_name', 'phone'],
  
  // Password change
  passwordChange: ['currentPassword', 'newPassword', 'confirmPassword']
};

/**
 * Get whitelist middleware for a specific entity
 */
function getEntityWhitelist(entityType) {
  const allowed = entityWhitelists[entityType];
  
  if (!allowed) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }
  
  return fieldWhitelist(allowed, { strict: true, logBlocked: true });
}

/**
 * Validate and sanitize update operations
 * Prevents partial updates from including dangerous fields
 */
function safeUpdate(allowedFields) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Request body required' });
    }
    
    const updates = {};
    let hasUpdates = false;
    
    for (const field of allowedFields) {
      if (field in req.body) {
        updates[field] = req.body[field];
        hasUpdates = true;
      }
    }
    
    if (!hasUpdates) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    req.safeUpdates = updates;
    next();
  };
}

module.exports = {
  fieldWhitelist,
  stripDangerousFields,
  DANGEROUS_FIELDS,
  entityWhitelists,
  getEntityWhitelist,
  safeUpdate
};
