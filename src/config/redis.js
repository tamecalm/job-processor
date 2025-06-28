import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient = null;

/**
 * Securely mask Redis URI for logging
 * @param {string} uri - Redis connection URI
 * @returns {string} Masked URI
 */
const maskRedisUri = (uri) => {
  if (!uri) return 'undefined';
  
  try {
    const url = new URL(uri);
    // Completely mask password and username
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    // Fallback for malformed URIs
    return uri.replace(/\/\/[^@]*@/, '//***:***@');
  }
};

export const connectRedis = async () => {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  try {
    // Security: Validate Redis URI format
    if (!config.redisUri || typeof config.redisUri !== 'string') {
      throw new Error('Redis URI not configured or invalid');
    }

    redisClient = createClient({
      url: config.redisUri,
      socket: {
        connectTimeout: 15000,
        keepAlive: 1000,
        tls: config.environment === 'production' || config.redisUri.startsWith('rediss://'),
        rejectUnauthorized: config.environment === 'production',
      },
      // Security: Disable potentially dangerous commands in production
      ...(config.environment === 'production' && {
        disableOfflineQueue: true,
        enableAutoPipelining: false
      })
    });

    // Event handlers for Redis client
    redisClient.on('error', (err) => {
      logger.error('Redis client error', {
        error: err.message,
        code: err.code,
        endpoint: maskRedisUri(config.redisUri)
      });
    });

    redisClient.on('connect', () => {
      logger.debug('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.debug('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.debug('Redis client disconnected');
    });

    await redisClient.connect();

    // Security: Test connection with minimal data exposure
    if (config.environment !== 'production') {
      const testKey = `health_check_${Date.now()}`;
      await redisClient.set(testKey, 'ok', { EX: 10 });
      const testValue = await redisClient.get(testKey);
      await redisClient.del(testKey); // Clean up immediately
      
      if (testValue === 'ok') {
        logger.debug('Redis connection test successful');
      } else {
        logger.warn('Redis connection test failed');
      }
    }

    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      endpoint: maskRedisUri(config.redisUri)
    });
    
    if (redisClient) {
      await redisClient.quit().catch(() => {});
      redisClient = null;
    }
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient || !redisClient.isOpen) {
    logger.debug('Redis client not initialized or not connected');
    return null;
  }
  return redisClient;
};

export const disconnectRedis = async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit().catch(() => {});
    logger.info('Redis client gracefully disconnected');
  }
  redisClient = null;
};