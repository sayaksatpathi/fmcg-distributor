/**
 * SSRF (Server-Side Request Forgery) Protection
 * Prevents attackers from making the server request internal resources
 */

const url = require('url');

// Private/Internal IP ranges that should NEVER be accessed
const BLOCKED_IP_RANGES = [
  // IPv4 Private ranges
  { start: '10.0.0.0', end: '10.255.255.255' },      // Class A private
  { start: '172.16.0.0', end: '172.31.255.255' },    // Class B private
  { start: '192.168.0.0', end: '192.168.255.255' },  // Class C private
  
  // Localhost
  { start: '127.0.0.0', end: '127.255.255.255' },    // Loopback
  
  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255' },  // Link-local
  
  // Other special ranges
  { start: '0.0.0.0', end: '0.255.255.255' },        // "This" network
  { start: '100.64.0.0', end: '100.127.255.255' },   // Carrier-grade NAT
  { start: '192.0.0.0', end: '192.0.0.255' },        // IETF Protocol Assignments
  { start: '192.0.2.0', end: '192.0.2.255' },        // TEST-NET-1
  { start: '198.51.100.0', end: '198.51.100.255' },  // TEST-NET-2
  { start: '203.0.113.0', end: '203.0.113.255' },    // TEST-NET-3
  { start: '224.0.0.0', end: '239.255.255.255' },    // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' }     // Reserved
];

// Cloud metadata endpoints (AWS, GCP, Azure, etc.)
const BLOCKED_HOSTNAMES = [
  '169.254.169.254',           // AWS/GCP metadata
  'metadata.google.internal',   // GCP
  'metadata.azure.com',         // Azure
  'metadata.internal',
  'localhost',
  '0.0.0.0',
  '::1',
  '[::]'
];

// Blocked URL schemes
const BLOCKED_SCHEMES = [
  'file:',
  'ftp:',
  'gopher:',
  'dict:',
  'sftp:',
  'ldap:',
  'tftp:'
];

/**
 * Convert IP address to number for range comparison
 */
function ipToNumber(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  
  return parts.reduce((acc, part) => {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return null;
    return (acc << 8) + num;
  }, 0);
}

/**
 * Check if IP is in blocked range
 */
function isBlockedIP(ip) {
  const ipNum = ipToNumber(ip);
  if (ipNum === null) return false;
  
  for (const range of BLOCKED_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if hostname is blocked
 */
function isBlockedHostname(hostname) {
  const lower = hostname.toLowerCase();
  
  // Direct match
  if (BLOCKED_HOSTNAMES.includes(lower)) {
    return true;
  }
  
  // Check for internal domain patterns
  if (lower.endsWith('.internal') || 
      lower.endsWith('.local') ||
      lower.endsWith('.localhost') ||
      lower.endsWith('.intranet')) {
    return true;
  }
  
  // Check if it's an IP address in blocked range
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return isBlockedIP(hostname);
  }
  
  return false;
}

/**
 * Validate URL is safe for server-side requests
 * @param {string} targetUrl - URL to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, error: 'Invalid URL' };
  }
  
  try {
    const parsed = new URL(targetUrl);
    
    // Check scheme
    if (BLOCKED_SCHEMES.includes(parsed.protocol)) {
      return { valid: false, error: `Blocked protocol: ${parsed.protocol}` };
    }
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'Only HTTP(S) URLs allowed' };
    }
    
    // Check hostname
    if (isBlockedHostname(parsed.hostname)) {
      return { valid: false, error: 'Blocked hostname' };
    }
    
    // Check for URL-encoded attacks
    const decodedHostname = decodeURIComponent(parsed.hostname);
    if (isBlockedHostname(decodedHostname)) {
      return { valid: false, error: 'Blocked hostname (encoded)' };
    }
    
    // Check port (block common internal service ports)
    const blockedPorts = [22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 27017, 9200];
    if (parsed.port && blockedPorts.includes(parseInt(parsed.port))) {
      return { valid: false, error: `Blocked port: ${parsed.port}` };
    }
    
    return { valid: true };
    
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Middleware to block SSRF attempts
 */
function ssrfProtection() {
  return (req, res, next) => {
    // Check common URL parameters
    const urlParams = ['url', 'uri', 'link', 'src', 'source', 'target', 'callback', 'webhook', 'redirect'];
    
    for (const param of urlParams) {
      const urlValue = req.query[param] || req.body?.[param];
      
      if (urlValue) {
        const validation = validateUrl(urlValue);
        
        if (!validation.valid) {
          console.warn(`[SECURITY] SSRF attempt blocked: ${urlValue} - ${validation.error} from IP: ${req.ip}`);
          
          return res.status(400).json({
            error: 'Invalid URL',
            code: 'SSRF_BLOCKED'
          });
        }
      }
    }
    
    next();
  };
}

/**
 * Safe fetch wrapper - use this instead of fetch/axios for user-provided URLs
 */
async function safeFetch(targetUrl, options = {}) {
  const validation = validateUrl(targetUrl);
  
  if (!validation.valid) {
    throw new Error(`SSRF Protection: ${validation.error}`);
  }
  
  // Use built-in fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 10000);
  
  try {
    const response = await fetch(targetUrl, {
      ...options,
      signal: controller.signal,
      redirect: 'manual' // Don't follow redirects automatically
    });
    
    clearTimeout(timeout);
    
    // Check redirect location
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const redirectValidation = validateUrl(location);
        if (!redirectValidation.valid) {
          throw new Error(`SSRF Protection: Blocked redirect to ${location}`);
        }
      }
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

module.exports = {
  validateUrl,
  ssrfProtection,
  safeFetch,
  isBlockedIP,
  isBlockedHostname,
  BLOCKED_IP_RANGES,
  BLOCKED_HOSTNAMES
};
