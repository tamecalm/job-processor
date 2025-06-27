import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient = null;

export const connectRedis = async () => {
  if (redisClient?.isOpen) {
    logger.warn('🔄 Redis client already connected');
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

    redisClient.on('error', (err) => {
      logger.warn('⚠️ Redis Client Error', {
        error: err.message,
        code: err.code,
        stack: err.stack,
        endpoint: config.redisUri.replace(/:[^@]+@/, ':***@'),
      });
    });

    redisClient.on('connect', () => {
      logger.warn('🔗 Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.warn('✅ Redis client ready');
    });

    redisClient.on('end', () => {
      logger.warn('🔌 Redis client disconnected');
    });

    await redisClient.connect();
    logger.warn(`✅ Redis connected successfully to ${config.redisUri.replace(/:[^@]+@/, ':***@')}`);

    if (config.environment !== 'production') {
      await redisClient.set('test_key', 'test_value', { EX: 60 });
      const testValue = await redisClient.get('test_key');
      if (testValue === 'test_value') {
        logger.warn('✅ Redis connection test successful');
      } else {
        logger.warn('⚠️ Redis connection test failed: unexpected value');
      }
    }

    return redisClient;
  } catch (error) {
    logger.warn('⚠️ Redis connection failed', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
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
    logger.warn('⚠️ Redis client not initialized or not connected');
    return null;
  }
  return redisClient;
};

export const disconnectRedis = async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit().catch(() => {});
    logger.warn('🔌 Redis client gracefully disconnected');
  }
  redisClient = null;
};