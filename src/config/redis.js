import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient = null;
let isConnecting = false;

const createRedisClient = () => {
  const redisOptions = {
    url: config.redisUri || 'rediss://default:AXUBAAIjcDEwNjE4MTYwYWRiZTE0YTc0OTU2M2FhODc5NjUyZWJjMHAxMA@charmed-parakeet-29953.upstash.io:6379',
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          logger.error('❌ Max Redis connection retries reached');
          return new Error('Max retries reached');
        }
        const delay = Math.min(retries * 200, 2000);
        logger.warn(`⚠️ Retrying Redis connection: attempt ${retries + 1}, delay ${delay}ms`);
        return delay;
      },
    },
  };

  const client = createClient(redisOptions);
  logger.info('🚀 Attempting Redis connection', {
    url: redisOptions.url.replace(/:[^@]+@/, ':***@'),
    connectTimeout: redisOptions.socket.connectTimeout,
  });

  client.on('error', (err) => {
    logger.error('❌ Redis Client Error', {
      error: err.message,
      code: err.code,
      stack: err.stack,
      endpoint: config.redisUri.replace(/:[^@]+@/, ':***@'),
      opensslVersion: process.versions.openssl,
      nodeVersion: process.versions.node,
    });
  });

  client.on('connect', () => {
    logger.info('🔗 Redis client connected');
  });

  client.on('ready', () => {
    logger.info('✅ Redis client ready');
  });

  client.on('end', () => {
    logger.info('🔌 Redis client disconnected');
  });

  client.on('reconnecting', () => {
    logger.info('🔄 Redis client reconnecting...');
  });

  return client;
};

export const connectRedis = async (retryCount = 0, maxRetries = 3) => {
  if (redisClient?.isOpen || isConnecting) {
    logger.info('🔄 Redis client already connected or connecting');
    return redisClient;
  }

  try {
    isConnecting = true;
    redisClient = createRedisClient();
    await redisClient.connect();

    logger.info(`✅ Redis connected successfully to ${config.redisUri.replace(/:[^@]+@/, ':***@')}`);

    if (redisClient.isOpen) {
      try {
        await redisClient.set('test_key', 'test_value', { EX: 60 });
        const testValue = await redisClient.get('test_key');
        if (testValue === 'test_value') {
          logger.info('✅ Redis connection test successful');
        } else {
          logger.warn('⚠️ Redis connection test failed: unexpected value');
        }
      } catch (testError) {
        logger.error('❌ Redis test operation failed', {
          error: testError.message,
          code: testError.code,
          stack: testError.stack,
        });
      }
    } else {
      logger.warn('⚠️ Redis client closed before test operation');
    }

    isConnecting = false;
    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection failed', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      retryCount,
      endpoint: config.redisUri.replace(/:[^@]+@/, ':***@'),
      opensslVersion: process.versions.openssl,
    });

    if (redisClient) {
      await redisClient.quit().catch(() => {});
      redisClient = null;
    }

    if (retryCount < maxRetries) {
      logger.info(`🔄 Retrying Redis connection (${retryCount + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return await connectRedis(retryCount + 1, maxRetries);
    }

    isConnecting = false;
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
    logger.info('🔌 Redis client gracefully disconnected');
  }
  redisClient = null;
};

process.on('SIGINT', async () => {
  await disconnectRedis();
  logger.info('🔌 Application shutdown: SIGINT');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
  logger.info('🔌 Application shutdown: SIGTERM');
  process.exit(0);
});