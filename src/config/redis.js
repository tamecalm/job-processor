import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient = null;

export const connectRedis = async () => {
  if (redisClient?.isOpen) {
    // logger.debug('Redis client already connected');
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: config.redisUri,
      socket: {
        connectTimeout: 15000,
        keepAlive: 1000,
        tls: config.environment === 'production',
        rejectUnauthorized: config.environment === 'production',
      },
    });

    // Event handlers for Redis client
    redisClient.on('error', (err) => {
      logger.error('Redis client error', {
        error: err.message,
        code: err.code,
        endpoint: config.redisUri.replace(/:[^@]+@/, ':***@'),
      });
    });

    redisClient.on('connect', () => {
      // logger.debug('Redis client connected');
    });

    redisClient.on('ready', () => {
      // logger.debug('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.debug('Redis client disconnected');
    });

    await redisClient.connect();

    // Test connection in non-production environments
    if (config.environment !== 'production') {
      await redisClient.set('test_key', 'test_value', { EX: 60 });
      const testValue = await redisClient.get('test_key');
      if (testValue === 'test_value') {
        logger.debug('Redis connection test successful');
      } else {
        logger.warn('Redis connection test failed - unexpected value');
      }
    }

    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      endpoint: config.redisUri.replace(/:[^@]+@/, ':***@'),
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