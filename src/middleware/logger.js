const config = require('../config');

// Simple request logger (Morgan-like functionality without external dependency)
const requestLogger = (options = {}) => {
  const format = options.format || config.logLevel || 'dev';
  const skip = options.skip || (() => false);

  // Color codes for terminal
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
  };

  const getStatusColor = (status) => {
    if (status >= 500) return colors.red;
    if (status >= 400) return colors.yellow;
    if (status >= 300) return colors.cyan;
    return colors.green;
  };

  const formatters = {
    // Development format: colored, concise
    dev: (req, res, responseTime) => {
      const status = res.statusCode;
      const statusColor = getStatusColor(status);
      const method = req.method;
      const url = req.originalUrl || req.url;
      
      return `${colors.gray}${method}${colors.reset} ${url} ${statusColor}${status}${colors.reset} ${colors.gray}${responseTime}ms${colors.reset}`;
    },

    // Combined format: Apache-style
    combined: (req, res, responseTime) => {
      const remoteAddr = req.ip || req.connection.remoteAddress || '-';
      const date = new Date().toISOString();
      const method = req.method;
      const url = req.originalUrl || req.url;
      const httpVersion = `HTTP/${req.httpVersionMajor}.${req.httpVersionMinor}`;
      const status = res.statusCode;
      const contentLength = res.get('Content-Length') || '-';
      const referrer = req.headers.referer || req.headers.referrer || '-';
      const userAgent = req.headers['user-agent'] || '-';

      return `${remoteAddr} - - [${date}] "${method} ${url} ${httpVersion}" ${status} ${contentLength} "${referrer}" "${userAgent}"`;
    },

    // Common format: simpler Apache-style
    common: (req, res, responseTime) => {
      const remoteAddr = req.ip || req.connection.remoteAddress || '-';
      const date = new Date().toISOString();
      const method = req.method;
      const url = req.originalUrl || req.url;
      const httpVersion = `HTTP/${req.httpVersionMajor}.${req.httpVersionMinor}`;
      const status = res.statusCode;
      const contentLength = res.get('Content-Length') || '-';

      return `${remoteAddr} - - [${date}] "${method} ${url} ${httpVersion}" ${status} ${contentLength}`;
    },

    // Short format
    short: (req, res, responseTime) => {
      const remoteAddr = req.ip || req.connection.remoteAddress || '-';
      const method = req.method;
      const url = req.originalUrl || req.url;
      const status = res.statusCode;
      const contentLength = res.get('Content-Length') || '-';

      return `${remoteAddr} ${method} ${url} ${status} ${contentLength} - ${responseTime} ms`;
    },

    // Tiny format
    tiny: (req, res, responseTime) => {
      const method = req.method;
      const url = req.originalUrl || req.url;
      const status = res.statusCode;
      const contentLength = res.get('Content-Length') || '-';

      return `${method} ${url} ${status} ${contentLength} - ${responseTime} ms`;
    }
  };

  const formatter = formatters[format] || formatters.dev;

  return (req, res, next) => {
    // Skip if needed
    if (skip(req, res)) {
      return next();
    }

    const startTime = Date.now();

    // Store original end function
    const originalEnd = res.end;

    // Override end function to log after response
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      const logLine = formatter(req, res, responseTime);
      console.log(logLine);

      // Call original end
      originalEnd.apply(res, args);
    };

    next();
  };
};

// Skip logging for certain paths (like health checks)
const skipPaths = ['/api/health', '/api/health/live', '/api/health/ready', '/favicon.ico'];

const defaultLogger = requestLogger({
  format: config.logLevel,
  skip: (req) => skipPaths.some(path => req.url.startsWith(path))
});

module.exports = {
  requestLogger,
  defaultLogger
};
