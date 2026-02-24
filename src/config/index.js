require('dotenv').config();

const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../distributor.db'),
  sessionSecret: process.env.SESSION_SECRET || 'default-secret-change-me',
  tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  logLevel: process.env.LOG_LEVEL || 'dev'
};
