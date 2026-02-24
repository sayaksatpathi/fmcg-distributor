const config = require('../config');

// CORS configuration middleware
const corsMiddleware = (options = {}) => {
  const defaults = {
    // Allowed origins (can be string, array, or function)
    origin: options.origin || '*',
    // Allowed methods
    methods: options.methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Allowed headers
    allowedHeaders: options.allowedHeaders || [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin'
    ],
    // Exposed headers (headers that browsers are allowed to access)
    exposedHeaders: options.exposedHeaders || [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    // Allow credentials (cookies, authorization headers)
    credentials: options.credentials !== undefined ? options.credentials : true,
    // Max age for preflight cache (in seconds)
    maxAge: options.maxAge || 86400, // 24 hours
    // Whether to pass preflight response to next handler
    preflightContinue: options.preflightContinue || false
  };

  return (req, res, next) => {
    const origin = req.headers.origin;

    // Handle origin
    if (defaults.origin === '*') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (typeof defaults.origin === 'string') {
      res.setHeader('Access-Control-Allow-Origin', defaults.origin);
    } else if (Array.isArray(defaults.origin)) {
      if (defaults.origin.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else if (typeof defaults.origin === 'function') {
      const allowed = defaults.origin(origin);
      if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }

    // Handle credentials
    if (defaults.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle exposed headers
    if (defaults.exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', defaults.exposedHeaders.join(', '));
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', defaults.methods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', defaults.allowedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', defaults.maxAge.toString());

      if (defaults.preflightContinue) {
        next();
      } else {
        res.status(204).end();
      }
      return;
    }

    next();
  };
};

// Default CORS configuration for local development
const defaultCors = corsMiddleware({
  origin: config.nodeEnv === 'production' 
    ? ['http://localhost:3000'] // Add your production domains here
    : '*',
  credentials: true
});

// Strict CORS for API endpoints
const apiCors = corsMiddleware({
  origin: (origin) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return true;
    
    // In development, allow all origins
    if (config.nodeEnv === 'development') return true;
    
    // In production, check against whitelist
    const whitelist = [
      'http://localhost:3000',
      // Add more allowed origins here
    ];
    return whitelist.includes(origin);
  },
  credentials: true
});

module.exports = {
  corsMiddleware,
  defaultCors,
  apiCors
};
