import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient = null;
let isConnecting = false;

const createRedisClient = () => {
  const redisOptions = {
    host: config.redisHost || 'redis-16422.c240.us-east-1-3.ec2.redns.redis-cloud.com',
    port: config.redisPort || 16422,
    username: config.redisUsername || 'default',
    password: config.redisPassword || '5l8ig5L8ReKWtomt5geQeOSz4ShoKCKy',
    tls: {}, // Enable TLS for Redis Cloud
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Max Redis connection retries reached');
        return null; // Stop retrying
      }
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Retrying Redis connection: attempt ${times}, delay ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err) => {
      logger.error('Redis reconnect error:', {
        error: err.message,
        code: err.code,
        stack: err.stack,
      });
      return true; // Attempt to reconnect on any error
    },
  };

  return new Redis(redisOptions);
};

export const connectRedis = async (retryCount = 0, maxRetries = 3) => {
  if (redisClient?.status === 'ready' || isConnecting) {
    logger.info('Redis client already connected or connecting');
    return redisClient;
  }

  try {
    isConnecting = true;
    redisClient = createRedisClient();

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', {
        error: err.message,
        code: err.code,
        stack: err.stack,
        tls: err.cause ? err.cause.toString() : 'No TLS details',
        opensslVersion: process.versions.openssl,
        nodeVersion: process.versions.node,
      });
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    // Wait for the client to be ready
    await new Promise((resolve, reject) => {
      redisClient.on('ready', resolve);
      redisClient.on('error', reject);
    });

    logger.info(`Redis connected successfully to ${config.redisUri || `${config.redisHost}:${config.redisPort}`}`);

    // Test connection with a set/get operation
    try {
      await redisClient.set('test_key', 'test_value', 'EX', 60);
      const тестValue = await redisClient.get('test_key');
      if (testValue === 'test_value') {
        logger.info('Redis connection test successful');
      } else {
        logger.warn('Redis connection test failed: unexpected value');
      }
    } catch (testError) {
      logger.error('Redis test operation failed:', {
        error: testError.message,
        code: testError.code,
        stack: testError.stack,
      });
    }

    isConnecting = false;
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      retryCount,
      opensslVersion: process.versions.openssl,
    });

    if (retryCount < maxRetries) {
      logger.info(`Retrying Redis connection (${retryCount + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return await connectRedis(retryCount + 1, maxRetries);
    }

    isConnecting = false;
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis first.');
  }
  return redisClient;
};

export const disconnectRedis = async () => {
  if (redisClient?.status === 'ready') {
    await redisClient.quit();
    logger.info('Redis client gracefully disconnected');
  }
};

process.on('SIGINT', async () => {
  await disconnectRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
  process.exit(0);
});