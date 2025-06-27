import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';

/**
 * Creates a rate limiter middleware with Redis or memory store fallback
 * @param {Object} options - Configuration options
 * @param {number} [options.points=1000] - Maximum number of requests allowed per window
 * @param {number} [options.duration=600] - Window duration in seconds (10 minutes)
 * @param {number} [options.blockDuration=600] - Block duration after limit in seconds
 * @param {string} [options.keyPrefix='rate-limit'] - Redis key prefix
 * @returns {Function} Express middleware function
 * @description
 * 1. Uses Redis store if available (from config/redis.js)
 * 2. Falls back to memory store if Redis is unavailable
 * 3. Returns middleware that limits requests based on IP
 * 4. Logs initialization status and errors
 */
export const createRateLimiter = (options = {}) => {
  const {
    points = 1000, // Increased to 1000 requests per window
    duration = 600, // 10-minute window
    blockDuration = 600, // 10-minute block after limit
    keyPrefix = 'rate-limit',
  } = options;

  let rateLimiter;

  /**
   * Redis client initialization:
   * - Gets Redis client from config/redis.js
   * - Used to create Redis-based rate limiter if available
   */
  const redisClient = getRedisClient();

  try {
    if (redisClient) {
      logger.info('Creating Redis-based rate limiter');
      rateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        points,
        duration,
        blockDuration,
        keyPrefix,
      });
    } else {
      logger.warn('Redis client not available, using memory store');
      rateLimiter = new RateLimiterMemory({
        points,
        duration,
        blockDuration,
        keyPrefix,
      });
    }
  } catch (err) {
    logger.error('Failed to initialize rate limiter', {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }

  /**
   * Express middleware implementation:
   * 1. Uses client IP as rate limit key (fallback if no user ID available)
   * 2. Attempts to consume a request point
   * 3. Calls next() if within limit
   * 4. Returns 429 error with rate limit message if exceeded
   * 5. Logs rate limit events with detailed context
   */
  // Return Express middleware
  return (req, res, next) => {
    /**
     * Rate limit key strategy:
     * - Uses client IP as default identifier
     * - Should be enhanced with user ID if available
     * - Consider combining multiple identifiers for better accuracy
     */
    // Use a more unique identifier than just IP (e.g., combine with user ID if available)
    const key = req.ip; // Fallback to IP if no user ID is available

    rateLimiter.consume(key)
      .then(() => {
        next();
      })
      .catch(() => {
        /**
         * Rate limit handling:
         * - Logs warning with rate limit key
         * - Returns 429 Too Many Requests response
         * - Includes standardized error message format
         */
        // Log the rate limit event
        logger.warn('Rate limit exceeded for key:', { key });
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      });
  };
};
