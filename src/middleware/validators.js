// Input validation middleware using express-validator style patterns
const validators = {
  // Retailer validation
  retailer: (req, res, next) => {
    const { name, area, phone, credit_limit, credit_class } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Name is required and must be at least 2 characters' });
    }

    if (phone && !/^[0-9]{10}$/.test(phone.replace(/\D/g, ''))) {
      errors.push({ field: 'phone', message: 'Phone must be a valid 10-digit number' });
    }

    if (credit_limit !== undefined && (isNaN(credit_limit) || credit_limit < 0)) {
      errors.push({ field: 'credit_limit', message: 'Credit limit must be a non-negative number' });
    }

    if (credit_class && !['A', 'B', 'C', 'D'].includes(credit_class)) {
      errors.push({ field: 'credit_class', message: 'Credit class must be A, B, C, or D' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Sanitize inputs
    req.body.name = name.trim();
    req.body.area = area ? area.trim() : '';
    req.body.phone = phone ? phone.replace(/\D/g, '') : '';
    req.body.credit_limit = parseFloat(credit_limit) || 0;

    next();
  },

  // Brand validation
  brand: (req, res, next) => {
    const { name, margin_slab } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Brand name is required and must be at least 2 characters' });
    }

    if (margin_slab !== undefined && (isNaN(margin_slab) || margin_slab < 0 || margin_slab > 100)) {
      errors.push({ field: 'margin_slab', message: 'Margin slab must be between 0 and 100' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    req.body.name = name.trim();
    req.body.margin_slab = parseFloat(margin_slab) || 0;

    next();
  },

  // SKU validation
  sku: (req, res, next) => {
    const { name, brand_id, purchase_price, selling_price, stock_in_hand } = req.body;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push({ field: 'name', message: 'SKU name is required and must be at least 2 characters' });
    }

    if (!brand_id || isNaN(brand_id)) {
      errors.push({ field: 'brand_id', message: 'Valid brand ID is required' });
    }

    if (purchase_price === undefined || isNaN(purchase_price) || purchase_price < 0) {
      errors.push({ field: 'purchase_price', message: 'Purchase price must be a non-negative number' });
    }

    if (selling_price === undefined || isNaN(selling_price) || selling_price < 0) {
      errors.push({ field: 'selling_price', message: 'Selling price must be a non-negative number' });
    }

    if (selling_price < purchase_price) {
      errors.push({ field: 'selling_price', message: 'Selling price should not be less than purchase price' });
    }

    if (stock_in_hand !== undefined && (isNaN(stock_in_hand) || stock_in_hand < 0)) {
      errors.push({ field: 'stock_in_hand', message: 'Stock must be a non-negative number' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    req.body.name = name.trim();
    req.body.brand_id = parseInt(brand_id);
    req.body.purchase_price = parseFloat(purchase_price);
    req.body.selling_price = parseFloat(selling_price);
    req.body.stock_in_hand = parseFloat(stock_in_hand) || 0;

    next();
  },

  // Sale validation
  sale: (req, res, next) => {
    const { date, retailer_id, items, payment_type } = req.body;
    const errors = [];

    if (!date || isNaN(Date.parse(date))) {
      errors.push({ field: 'date', message: 'Valid date is required' });
    }

    if (!retailer_id || isNaN(retailer_id)) {
      errors.push({ field: 'retailer_id', message: 'Valid retailer ID is required' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push({ field: 'items', message: 'At least one item is required' });
    } else {
      items.forEach((item, index) => {
        if (!item.sku_id || isNaN(item.sku_id)) {
          errors.push({ field: `items[${index}].sku_id`, message: 'Valid SKU ID is required' });
        }
        if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
          errors.push({ field: `items[${index}].quantity`, message: 'Quantity must be a positive number' });
        }
      });
    }

    if (!payment_type || !['cash', 'credit'].includes(payment_type)) {
      errors.push({ field: 'payment_type', message: 'Payment type must be cash or credit' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    req.body.retailer_id = parseInt(retailer_id);
    req.body.items = items.map(item => ({
      sku_id: parseInt(item.sku_id),
      quantity: parseFloat(item.quantity)
    }));

    next();
  },

  // Payment validation
  payment: (req, res, next) => {
    const { retailer_id, amount, payment_date, payment_method } = req.body;
    const errors = [];

    if (!retailer_id || isNaN(retailer_id)) {
      errors.push({ field: 'retailer_id', message: 'Valid retailer ID is required' });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      errors.push({ field: 'amount', message: 'Amount must be a positive number' });
    }

    if (!payment_date || isNaN(Date.parse(payment_date))) {
      errors.push({ field: 'payment_date', message: 'Valid payment date is required' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    req.body.retailer_id = parseInt(retailer_id);
    req.body.amount = parseFloat(amount);
    req.body.payment_method = payment_method || 'cash';

    next();
  },

  // Product test validation
  productTest: (req, res, next) => {
    const { product_name, batch_size, total_cost, selling_price, expected_margin } = req.body;
    const errors = [];

    if (!product_name || typeof product_name !== 'string' || product_name.trim().length < 2) {
      errors.push({ field: 'product_name', message: 'Product name is required' });
    }

    if (!batch_size || isNaN(batch_size) || batch_size <= 0) {
      errors.push({ field: 'batch_size', message: 'Batch size must be a positive number' });
    }

    if (!total_cost || isNaN(total_cost) || total_cost <= 0) {
      errors.push({ field: 'total_cost', message: 'Total cost must be a positive number' });
    }

    if (!selling_price || isNaN(selling_price) || selling_price <= 0) {
      errors.push({ field: 'selling_price', message: 'Selling price must be a positive number' });
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    req.body.product_name = product_name.trim();
    req.body.batch_size = parseFloat(batch_size);
    req.body.total_cost = parseFloat(total_cost);
    req.body.selling_price = parseFloat(selling_price);
    req.body.expected_margin = parseFloat(expected_margin) || 0;

    next();
  },

  // Login validation (generic error messages to prevent user enumeration)
  login: (req, res, next) => {
    const { username, password } = req.body;

    // Generic validation - don't reveal which field is wrong
    if (!username || typeof username !== 'string' || username.trim().length < 3 ||
        !password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ 
        error: 'Invalid credentials format'  // Generic message
      });
    }

    // Sanitize username (prevent injection)
    req.body.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    next();
  },

  // Password strength validation for registration/change password
  passwordStrength: (req, res, next) => {
    const { password, newPassword } = req.body;
    const pwd = newPassword || password;
    const errors = [];

    if (!pwd || typeof pwd !== 'string') {
      errors.push({ field: 'password', message: 'Password is required' });
    } else {
      // Minimum 8 characters
      if (pwd.length < 8) {
        errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
      }
      // Maximum 128 characters (prevent DoS with bcrypt)
      if (pwd.length > 128) {
        errors.push({ field: 'password', message: 'Password must not exceed 128 characters' });
      }
      // At least one uppercase
      if (!/[A-Z]/.test(pwd)) {
        errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' });
      }
      // At least one lowercase
      if (!/[a-z]/.test(pwd)) {
        errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' });
      }
      // At least one number
      if (!/[0-9]/.test(pwd)) {
        errors.push({ field: 'password', message: 'Password must contain at least one number' });
      }
      // Check for common weak passwords
      const weakPasswords = ['password', '12345678', 'qwerty123', 'admin123', 'letmein'];
      if (weakPasswords.includes(pwd.toLowerCase())) {
        errors.push({ field: 'password', message: 'Password is too common, please choose a stronger one' });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    next();
  },

  // ID parameter validation
  idParam: (req, res, next) => {
    const { id } = req.params;
    
    if (!id || isNaN(id) || parseInt(id) <= 0) {
      return res.status(400).json({ error: 'Invalid ID parameter' });
    }
    
    req.params.id = parseInt(id);
    next();
  }
};

module.exports = validators;
