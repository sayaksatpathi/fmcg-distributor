/**
 * Business Logic Protection
 * Prevents abuse through logical manipulation
 */

/**
 * Validate numeric ranges for business rules
 */
function validateBusinessRules(rules) {
  return (req, res, next) => {
    const errors = [];
    
    for (const rule of rules) {
      const value = getNestedValue(req.body, rule.field);
      
      if (value !== undefined && value !== null) {
        // Type check
        if (rule.type === 'number') {
          const num = parseFloat(value);
          
          if (isNaN(num)) {
            errors.push(`${rule.field} must be a valid number`);
            continue;
          }
          
          // Minimum value (prevent negative quantities, etc.)
          if (rule.min !== undefined && num < rule.min) {
            errors.push(`${rule.field} cannot be less than ${rule.min}`);
          }
          
          // Maximum value (prevent unrealistic values)
          if (rule.max !== undefined && num > rule.max) {
            errors.push(`${rule.field} cannot exceed ${rule.max}`);
          }
          
          // Integer check
          if (rule.integer && !Number.isInteger(num)) {
            errors.push(`${rule.field} must be a whole number`);
          }
          
          // Positive check
          if (rule.positive && num <= 0) {
            errors.push(`${rule.field} must be positive`);
          }
        }
        
        // String length checks
        if (rule.type === 'string') {
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${rule.field} cannot exceed ${rule.maxLength} characters`);
          }
          
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
          }
        }
        
        // Enum check
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${rule.field} must be one of: ${rule.enum.join(', ')}`);
        }
      } else if (rule.required) {
        errors.push(`${rule.field} is required`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'BUSINESS_RULE_VIOLATION',
        details: errors
      });
    }
    
    next();
  };
}

/**
 * Common business rules for FMCG operations
 */
const commonBusinessRules = {
  // Sale validation
  sale: [
    { field: 'quantity', type: 'number', min: 1, max: 100000, integer: true, positive: true },
    { field: 'price', type: 'number', min: 0.01, max: 10000000 },
    { field: 'discount', type: 'number', min: 0, max: 100 }, // Percentage
    { field: 'amount_paid', type: 'number', min: 0 }
  ],
  
  // Payment validation
  payment: [
    { field: 'amount', type: 'number', min: 0.01, max: 100000000, required: true },
    { field: 'payment_method', type: 'string', enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'credit_note'] }
  ],
  
  // Retailer validation
  retailer: [
    { field: 'credit_limit', type: 'number', min: 0, max: 100000000 },
    { field: 'phone', type: 'string', minLength: 10, maxLength: 15 }
  ],
  
  // SKU validation
  sku: [
    { field: 'mrp', type: 'number', min: 0.01, max: 1000000 },
    { field: 'purchase_price', type: 'number', min: 0.01, max: 1000000 },
    { field: 'selling_price', type: 'number', min: 0.01, max: 1000000 },
    { field: 'stock_in_hand', type: 'number', min: 0, integer: true }
  ],
  
  // Stock adjustment
  stockAdjustment: [
    { field: 'quantity', type: 'number', min: -100000, max: 100000, integer: true },
    { field: 'reason', type: 'string', required: true, minLength: 3, maxLength: 500 }
  ]
};

/**
 * Prevent common business logic exploits
 */
function businessLogicGuard() {
  return (req, res, next) => {
    if (!req.body) return next();
    
    const exploits = [];
    
    // 1. Check for negative quantities (when buying/selling)
    if ('quantity' in req.body) {
      const qty = parseFloat(req.body.quantity);
      if (qty < 0 && !req.path.includes('adjustment') && !req.path.includes('return')) {
        exploits.push('Negative quantity not allowed for this operation');
      }
    }
    
    // 2. Check for zero/negative prices in sales
    if ('price' in req.body && req.method === 'POST') {
      const price = parseFloat(req.body.price);
      if (price <= 0 && !req.path.includes('return') && !req.path.includes('credit')) {
        exploits.push('Price must be positive');
      }
    }
    
    // 3. Check for discount > 100%
    if ('discount' in req.body) {
      const discount = parseFloat(req.body.discount);
      if (discount > 100 || discount < 0) {
        exploits.push('Discount must be between 0 and 100 percent');
      }
    }
    
    // 4. Check for amount_paid > total (overpayment exploit)
    if ('amount_paid' in req.body && 'total' in req.body) {
      const paid = parseFloat(req.body.amount_paid);
      const total = parseFloat(req.body.total);
      if (paid > total * 1.1) { // Allow 10% buffer for tips/rounding
        exploits.push('Payment amount exceeds order total');
      }
    }
    
    // 5. Check for unrealistic dates
    if ('date' in req.body) {
      const date = new Date(req.body.date);
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (date < oneYearAgo) {
        exploits.push('Date cannot be more than 1 year in the past');
      }
      if (date > oneMonthAhead) {
        exploits.push('Date cannot be more than 1 month in the future');
      }
    }
    
    // 6. Check for duplicate items in array (double-charging exploit)
    if ('items' in req.body && Array.isArray(req.body.items)) {
      const skuIds = req.body.items.map(item => item.sku_id || item.skuId);
      const uniqueIds = new Set(skuIds);
      if (uniqueIds.size !== skuIds.length) {
        exploits.push('Duplicate items detected - combine quantities instead');
      }
    }
    
    if (exploits.length > 0) {
      console.warn(`[SECURITY] Business logic exploit attempt from IP: ${req.ip}`, exploits);
      
      return res.status(400).json({
        error: 'Invalid request',
        code: 'BUSINESS_LOGIC_VIOLATION',
        details: exploits
      });
    }
    
    next();
  };
}

/**
 * Validate sale total matches item calculations (server-side recalculation)
 */
function validateSaleCalculations() {
  return (req, res, next) => {
    if (!req.body.items || !Array.isArray(req.body.items)) {
      return next();
    }
    
    let calculatedTotal = 0;
    
    for (const item of req.body.items) {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      const discount = parseFloat(item.discount) || 0;
      
      const itemTotal = quantity * price * (1 - discount / 100);
      calculatedTotal += itemTotal;
    }
    
    // Round to 2 decimal places
    calculatedTotal = Math.round(calculatedTotal * 100) / 100;
    
    // Store calculated total (use this instead of client-provided)
    req.calculatedTotal = calculatedTotal;
    
    // Warn if client total doesn't match (but don't block - use server calculation)
    if (req.body.total !== undefined) {
      const clientTotal = parseFloat(req.body.total);
      if (Math.abs(clientTotal - calculatedTotal) > 0.01) {
        console.warn(`[SECURITY] Sale total mismatch: client=${clientTotal}, server=${calculatedTotal}`);
        // Override with server calculation
        req.body.total = calculatedTotal;
      }
    }
    
    next();
  };
}

/**
 * Rate limit on high-value operations
 */
function highValueOperationGuard(options = {}) {
  const {
    maxPerHour = 100, // Max operations per hour per user
    valueThreshold = 100000, // Operations above this value are tracked
    operationType = 'general'
  } = options;
  
  const operationCounts = new Map();
  
  // Cleanup old entries every hour
  setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, data] of operationCounts.entries()) {
      data.timestamps = data.timestamps.filter(t => t > oneHourAgo);
      if (data.timestamps.length === 0) {
        operationCounts.delete(key);
      }
    }
  }, 60 * 60 * 1000);
  
  return (req, res, next) => {
    if (!req.user) return next();
    
    const value = parseFloat(req.body.total || req.body.amount || 0);
    
    // Only track high-value operations
    if (value < valueThreshold) return next();
    
    const key = `${req.user.id}-${operationType}`;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    let userData = operationCounts.get(key);
    if (!userData) {
      userData = { timestamps: [] };
      operationCounts.set(key, userData);
    }
    
    // Clean old timestamps
    userData.timestamps = userData.timestamps.filter(t => t > oneHourAgo);
    
    if (userData.timestamps.length >= maxPerHour) {
      console.warn(`[SECURITY] High-value operation rate limit: User ${req.user.id}, type: ${operationType}`);
      
      return res.status(429).json({
        error: 'Too many high-value operations. Please wait.',
        code: 'HIGH_VALUE_RATE_LIMIT',
        retryAfter: 3600
      });
    }
    
    userData.timestamps.push(now);
    next();
  };
}

// Helper function
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => 
    current && current[key] !== undefined ? current[key] : undefined, obj);
}

module.exports = {
  validateBusinessRules,
  commonBusinessRules,
  businessLogicGuard,
  validateSaleCalculations,
  highValueOperationGuard
};
