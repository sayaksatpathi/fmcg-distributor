const config = require('../config');

// Simple in-memory rate limiter
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 1000; // INCREASED DEFAULT
    this.message = options.message || 'Too many requests, please try again later';
    this.requests = new Map();

    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now - data.startTime > this.windowMs) {
        this.requests.delete(key);
      }
    }
  }

  getKey(req) {
    // Use IP address as key, or fall back to a default
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  middleware() {
    return (req, res, next) => {
      const key = this.getKey(req);
      const now = Date.now();

      if (!this.requests.has(key)) {
        this.requests.set(key, {
          count: 1,
          startTime: now
        });
        return next();
      }

      const data = this.requests.get(key);

      // Reset if window has passed
      if (now - data.startTime > this.windowMs) {
        this.requests.set(key, {
          count: 1,
          startTime: now
        });
        return next();
      }

      // Increment count
      data.count++;

      // Check if limit exceeded
      if (data.count > this.maxRequests) {
        const retryAfter = Math.ceil((this.windowMs - (now - data.startTime)) / 1000);

        res.set('Retry-After', retryAfter);
        res.set('X-RateLimit-Limit', this.maxRequests);
        res.set('X-RateLimit-Remaining', 0);
        res.set('X-RateLimit-Reset', new Date(data.startTime + this.windowMs).toISOString());

        return res.status(429).json({
          error: this.message,
          retryAfter: retryAfter
        });
      }

      // Set rate limit headers
      res.set('X-RateLimit-Limit', this.maxRequests);
      res.set('X-RateLimit-Remaining', this.maxRequests - data.count);
      res.set('X-RateLimit-Reset', new Date(data.startTime + this.windowMs).toISOString());

      next();
    };
  }
}

// Create instances for different rate limits
const createRateLimiter = (options) => {
  return new RateLimiter(options).middleware();
};

// Default rate limiter
// RELAXED LIMIT: 1000 per 15 mins (was 100)
const defaultLimiter = createRateLimiter({
  windowMs: config.rateLimit?.windowMs || 15 * 60 * 1000,
  maxRequests: 2000 // Very generous limit
});

// Strict rate limiter for sensitive endpoints (login, etc.)
// KEEP STRICT for security
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20, // Increased slightly from 5 to 20 to allow for mistakes
  message: 'Too many login attempts, please try again in 15 minutes'
});

// API rate limiter
// RELAXED LIMIT: 5000 per minute (was 60)
const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 5000
});

module.exports = {
  RateLimiter,
  createRateLimiter,
  defaultLimiter,
  authLimiter,
  apiLimiter
};
