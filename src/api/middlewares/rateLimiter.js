import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';

export const createRateLimiter = (options = {}) => {
  const {
    points = 10000,
    duration = 3600,
    blockDuration = 3600,
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
    const key = req.ip;

    rateLimiter.consume(key)
      .then(() => {
        next();
      })
      .catch(() => {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      });
  };
};
