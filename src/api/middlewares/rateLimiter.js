import rateLimit from 'express-rate-limit';
import { logger } from '../../utils/logger.js';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  onLimitReached: (req, res, options) => {
    logger.warn(`Rate limit reached for IP ${req.ip}`);
  },
});