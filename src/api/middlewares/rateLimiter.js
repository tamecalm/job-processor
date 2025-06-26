import rateLimit from 'express-rate-limit';
import { logger } from '../../utils/logger.js';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res, next, options) => {
  logger.warn(`Rate limit exceeded for IP ${req.ip}`, {
    endpoint: req.originalUrl,
    method: req.method,
  });
  res.status(options.statusCode).json({
    error: options.message,
    retryAfter: Math.ceil(options.windowMs / 1000), // Seconds until reset
  });
},
});