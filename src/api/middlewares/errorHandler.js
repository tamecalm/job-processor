import { logger } from '../../utils/logger.js';

/**
 * Global error handling middleware
 * @param {Error} err - Error object passed from try/catch or next()
 * @param {Object} res - Express response object
 * @description
 * 1. Logs detailed error information (message + stack trace)
 * 2. Sets appropriate HTTP status code (uses err.statusCode if available)
 * 3. Returns standardized error response format
 * @response_format
 * {
 *   error: {
 *     message: string,
 *     statusCode: number
 *   }
 * }
 */
export const errorHandler = (err, res) => {
  /**
   * Error logging:
   * - Records error message and stack trace
   * - Uses logger.error for proper error tracking
   * - Includes stack trace in log context
   */
  logger.error('Error:', err.message, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  /**
   * Error response formatting:
   * - Sets HTTP status code
   * - Returns standardized JSON error object
   * - Includes both error message and status code
   */
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      statusCode,
    },
  });
};