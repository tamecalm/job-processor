import { logger } from '../../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err.message, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      statusCode,
    },
  });
};