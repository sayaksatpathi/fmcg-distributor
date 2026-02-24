// Global error handling middleware
const config = require('../config');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'ERROR';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Not found handler (404)
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Log error
  if (config.nodeEnv === 'development') {
    console.error('Error:', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  } else {
    // In production, only log server errors
    if (err.statusCode >= 500) {
      console.error('Server Error:', {
        message: err.message,
        code: err.code,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
  }

  // SQLite specific error handling
  if (err.message && err.message.includes('SQLITE')) {
    if (err.message.includes('UNIQUE constraint failed')) {
      err.statusCode = 409;
      err.code = 'DUPLICATE_ENTRY';
      err.message = 'A record with this value already exists';
    } else if (err.message.includes('FOREIGN KEY constraint failed')) {
      err.statusCode = 400;
      err.code = 'INVALID_REFERENCE';
      err.message = 'Referenced record does not exist';
    } else {
      err.statusCode = 500;
      err.code = 'DATABASE_ERROR';
      if (config.nodeEnv !== 'development') {
        err.message = 'A database error occurred';
      }
    }
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    err.statusCode = 400;
    err.message = 'File size exceeds the limit (10MB)';
  }

  // Send error response
  const response = {
    error: err.message,
    code: err.code
  };

  // Include stack trace in development
  if (config.nodeEnv === 'development') {
    response.stack = err.stack;
  }

  res.status(err.statusCode).json(response);
};

// Async handler wrapper to catch async errors
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  notFoundHandler,
  errorHandler,
  asyncHandler
};
