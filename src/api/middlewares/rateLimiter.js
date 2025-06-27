import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';

export const createRateLimiter = (options = {}) => {
  const {
    points = 1000, // Increased to 1000 requests per window
    duration = 600, // 10-minute window
    blockDuration = 600, // 10-minute block after limit
    keyPrefix = 'rate-limit',
  } = options;

  let rateLimiter;

  const redisClient = getRedisClient();

  try {
    if (redisClient) {
      logger.info('🚀 Creating Redis-based rate limiter');
      rateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        points,
        duration,
        blockDuration,
        keyPrefix,
      });
    } else {
      logger.warn('⚠️ Redis client not available, using memory store');
      rateLimiter = new RateLimiterMemory({
        points,
        duration,
        blockDuration,
        keyPrefix,
      });
    }
  } catch (err) {
    logger.error('❌ Failed to initialize rate limiter', {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }

  // Return Express middleware
  return (req, res, next) => {
    // Use a more unique identifier than just IP (e.g., combine with user ID if available)
    const key = req.ip; // Fallback to IP if no user ID is available

    rateLimiter.consume(key)
      .then(() => {
        next();
      })
      .catch(() => {
        // Log the rate limit event
        logger.warn('⚠️ Rate limit exceeded for key:', { key });
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      });
  };
};
