// Security headers middleware using Helmet-like functionality
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate a cryptographically secure nonce for CSP
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Security headers middleware
 * Implements OWASP security best practices with nonce-based CSP
 */
const securityHeaders = (options = {}) => {
  const defaults = {
    // Content Security Policy
    contentSecurityPolicy: options.contentSecurityPolicy !== false,
    // X-DNS-Prefetch-Control
    dnsPrefetchControl: options.dnsPrefetchControl !== false,
    // X-Frame-Options
    frameguard: options.frameguard !== false,
    // Strict-Transport-Security
    hsts: options.hsts !== false,
    // X-Download-Options
    ieNoOpen: options.ieNoOpen !== false,
    // X-Content-Type-Options
    noSniff: options.noSniff !== false,
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: options.permittedCrossDomainPolicies !== false,
    // Referrer-Policy
    referrerPolicy: options.referrerPolicy || 'strict-origin-when-cross-origin',
    // X-XSS-Protection (legacy but still useful)
    xssFilter: options.xssFilter !== false,
    // Remove X-Powered-By
    hidePoweredBy: options.hidePoweredBy !== false,
    // Use nonces instead of unsafe-inline (Disabled by default for static HTML compatibility)
    useNonces: options.useNonces !== false && false // Force false for now
  };

  return (req, res, next) => {
    // Generate unique nonce for this request
    const nonce = generateNonce();
    res.locals.cspNonce = nonce;
    req.cspNonce = nonce;

    // Remove X-Powered-By header
    if (defaults.hidePoweredBy) {
      res.removeHeader('X-Powered-By');
    }

    // Content Security Policy with NONCES (no more unsafe-inline!)
    if (defaults.contentSecurityPolicy) {
      const csp = options.cspDirectives || {
        defaultSrc: ["'self'"],
        // Use nonce instead of 'unsafe-inline' for better security
        scriptSrc: defaults.useNonces
          ? ["'self'", `'nonce-${nonce}'`]
          : ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Always use unsafe-inline for styles to support style="..." attributes
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null
      };

      const cspString = Object.entries(csp)
        .filter(([_, value]) => value !== null)
        .map(([key, value]) => {
          const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          if (Array.isArray(value) && value.length === 0) {
            return directive;
          }
          return `${directive} ${Array.isArray(value) ? value.join(' ') : value}`;
        })
        .join('; ');

      res.setHeader('Content-Security-Policy', cspString);
    }

    // X-DNS-Prefetch-Control
    if (defaults.dnsPrefetchControl) {
      res.setHeader('X-DNS-Prefetch-Control', 'off');
    }

    // X-Frame-Options (Clickjacking protection)
    if (defaults.frameguard) {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    // Strict-Transport-Security (HTTPS enforcement)
    if (defaults.hsts && config.nodeEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // X-Download-Options (IE8+ protection)
    if (defaults.ieNoOpen) {
      res.setHeader('X-Download-Options', 'noopen');
    }

    // X-Content-Type-Options (MIME sniffing protection)
    if (defaults.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-Permitted-Cross-Domain-Policies
    if (defaults.permittedCrossDomainPolicies) {
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    }

    // Referrer-Policy
    if (defaults.referrerPolicy) {
      res.setHeader('Referrer-Policy', defaults.referrerPolicy);
    }

    // X-XSS-Protection (legacy browsers)
    if (defaults.xssFilter) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // Permissions-Policy (formerly Feature-Policy)
    res.setHeader('Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');

    // Cross-Origin headers for additional isolation
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Cache-Control for sensitive pages
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
};

module.exports = { securityHeaders, generateNonce };
