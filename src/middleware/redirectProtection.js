/**
 * Open Redirect Protection Middleware
 * Prevents attackers from using your domain to redirect to malicious sites
 */

// Whitelist of allowed redirect paths (internal only)
const ALLOWED_REDIRECT_PATHS = [
  '/',
  '/dashboard',
  '/dashboard.html',
  '/retailers',
  '/retailers.html',
  '/brands-skus',
  '/brands-skus.html',
  '/dispatch',
  '/dispatch.html',
  '/credit-control',
  '/credit-control.html',
  '/profit-analysis',
  '/profit-analysis.html',
  '/weekly-review',
  '/weekly-review.html',
  '/product-test',
  '/product-test.html',
  '/excel-import',
  '/excel-import.html'
];

// Allowed domains for external redirects (if any)
const ALLOWED_EXTERNAL_DOMAINS = [
  // Add trusted domains here if needed
  // 'trusted-partner.com'
];

/**
 * Validate if a redirect URL is safe
 */
function isValidRedirectUrl(url, req) {
  if (!url) return false;
  
  // Remove any whitespace and null bytes
  url = url.trim().replace(/\0/g, '');
  
  // Block javascript: and data: URLs
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('vbscript:')) {
    return false;
  }
  
  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) {
    return false;
  }
  
  // Check if it's a relative path (starts with /)
  if (url.startsWith('/')) {
    // Prevent path traversal in redirects
    if (url.includes('..') || url.includes('//')) {
      return false;
    }
    
    // Extract just the path (remove query string)
    const pathOnly = url.split('?')[0].split('#')[0];
    
    // Check against whitelist
    return ALLOWED_REDIRECT_PATHS.some(allowed => 
      pathOnly === allowed || pathOnly.startsWith(allowed + '/')
    );
  }
  
  // Check if it's an absolute URL
  try {
    const parsedUrl = new URL(url);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Check against allowed external domains
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Allow same origin
    if (req && req.headers.host) {
      const requestHost = req.headers.host.split(':')[0].toLowerCase();
      if (hostname === requestHost || hostname === 'localhost') {
        return true;
      }
    }
    
    // Check external whitelist
    return ALLOWED_EXTERNAL_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    
  } catch (e) {
    // Invalid URL
    return false;
  }
}

/**
 * Middleware to validate redirect parameters
 */
function redirectProtection() {
  return (req, res, next) => {
    // Check common redirect parameter names
    const redirectParams = ['redirect', 'redirectUrl', 'redirect_url', 'return', 'returnUrl', 'return_url', 'next', 'url', 'goto', 'dest', 'destination'];
    
    for (const param of redirectParams) {
      const redirectValue = req.query[param] || req.body?.[param];
      
      if (redirectValue && !isValidRedirectUrl(redirectValue, req)) {
        console.warn(`[SECURITY] Blocked invalid redirect attempt: ${redirectValue} from IP: ${req.ip}`);
        
        return res.status(400).json({ 
          error: 'Invalid redirect URL',
          code: 'INVALID_REDIRECT'
        });
      }
    }
    
    next();
  };
}

/**
 * Safe redirect function - use this instead of res.redirect()
 */
function safeRedirect(req, res, defaultUrl = '/') {
  return (url) => {
    if (isValidRedirectUrl(url, req)) {
      return res.redirect(url);
    }
    console.warn(`[SECURITY] Attempted unsafe redirect to: ${url}, redirecting to default`);
    return res.redirect(defaultUrl);
  };
}

module.exports = {
  redirectProtection,
  safeRedirect,
  isValidRedirectUrl,
  ALLOWED_REDIRECT_PATHS,
  ALLOWED_EXTERNAL_DOMAINS
};
