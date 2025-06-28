/* eslint-disable no-unused-vars */
import { logger } from '../../utils/logger.js';

/**
 * Global error handling middleware with security considerations
 * @param {Error} err - Error object passed from try/catch or next()
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const errorHandler = (err, req, res, next) => {
  // Security: Sanitize error information for logging
  const sanitizedError = {
    message: err.message,
    name: err.name,
    statusCode: err.statusCode || 500,
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Log error with request context but avoid sensitive data
  logger.error('Request error', {
    error: sanitizedError,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')?.substring(0, 100),
    user: req.user?.user || 'anonymous'
  });

  const statusCode = err.statusCode || 500;
  
  // Security: Different error responses for production vs development
  if (process.env.NODE_ENV === 'production') {
    // Production: Generic error messages to prevent information disclosure
    const productionErrors = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden', 
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error'
    };

    res.status(statusCode).json({
      error: {
        message: productionErrors[statusCode] || 'An error occurred',
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    // Development: More detailed error information
    res.status(statusCode).json({
      error: {
        message: err.message || 'Internal Server Error',
        statusCode,
        timestamp: new Date().toISOString(),
        ...(err.stack && { stack: err.stack })
      }
    });
  }
};