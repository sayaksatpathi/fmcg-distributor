/**
 * CSP Nonce Middleware
 * Generates per-request nonces for inline scripts to remove 'unsafe-inline'
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically secure nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * CSP Nonce middleware
 * Generates a unique nonce for each request and adds it to res.locals
 */
const cspNonceMiddleware = (req, res, next) => {
  // Generate unique nonce for this request
  const nonce = generateNonce();
  
  // Store nonce in res.locals for use in templates/responses
  res.locals.cspNonce = nonce;
  
  // Also attach to request for other middleware
  req.cspNonce = nonce;
  
  next();
};

/**
 * Generate CSP header with nonces
 * This replaces 'unsafe-inline' with nonce-based CSP
 */
const generateCSPWithNonce = (nonce, options = {}) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    'style-src': ["'self'", `'nonce-${nonce}'`],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'require-trusted-types-for': ["'script'"],
    ...(isProduction ? { 'upgrade-insecure-requests': [] } : {})
  };

  // Allow customization
  if (options.additionalScriptSrc) {
    directives['script-src'].push(...options.additionalScriptSrc);
  }
  if (options.additionalStyleSrc) {
    directives['style-src'].push(...options.additionalStyleSrc);
  }
  if (options.additionalConnectSrc) {
    directives['connect-src'].push(...options.additionalConnectSrc);
  }

  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
};

/**
 * Inject nonce into HTML responses
 * Replaces <script> and <style> tags with nonce attributes
 */
const injectNonceIntoHTML = (html, nonce) => {
  // Add nonce to script tags that don't have src (inline scripts)
  html = html.replace(/<script(?![^>]*\bsrc\b)([^>]*)>/gi, (match, attrs) => {
    // Don't add nonce if already has one
    if (attrs.includes('nonce=')) return match;
    return `<script nonce="${nonce}"${attrs}>`;
  });
  
  // Add nonce to style tags
  html = html.replace(/<style([^>]*)>/gi, (match, attrs) => {
    if (attrs.includes('nonce=')) return match;
    return `<style nonce="${nonce}"${attrs}>`;
  });
  
  return html;
};

/**
 * HTML response wrapper that auto-injects nonces
 */
const sendSecureHTML = (res, html) => {
  const nonce = res.locals.cspNonce;
  if (nonce) {
    html = injectNonceIntoHTML(html, nonce);
  }
  res.type('html').send(html);
};

module.exports = {
  generateNonce,
  cspNonceMiddleware,
  generateCSPWithNonce,
  injectNonceIntoHTML,
  sendSecureHTML
};
