import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient = null;
let isConnecting = false;

const createRedisClient = () => {
  const redisOptions = {
    url: config.redisUri,
    username: config.redisUsername,// Redis Cloud username
    password: config.redisPassword, // Redis Cloud password
    socket: {
      host: config.redisHost, // Redis Cloud host
      port: config.redisPort || 16422, // Redis Cloud port
      tls: config.environment === 'production', // Enable TLS for production (Redis Cloud requires it)
      rejectUnauthorized: config.environment !== 'production', // Allow self-signed certs in dev
      reconnectStrategy: (retries) => {
        const delay = Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        logger.warn(`Retrying Redis connection: attempt ${retries}, delay ${delay}ms`);
        return delay;
      },
    },
  };

  return createClient(redisOptions);
};

export const connectRedis = async () => {
  if (redisClient?.isOpen || isConnecting) {
    logger.info('Redis client already connected or connecting');
    return redisClient;
  }

  try {
    isConnecting = true;
    redisClient = createRedisClient();

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
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

    await redisClient.connect();
    logger.info(`Redis connected successfully to ${config.redisUri || `${config.redisHost}:${config.redisPort}`}`);
    
    // Test connection with a simple set/get operation
    await redisClient.set('test_key', 'test_value');
    const testValue = await redisClient.get('test_key');
    if (testValue === 'test_value') {
      logger.info('Redis connection test successful');
    } else {
      logger.warn('Redis connection test failed');
    }

    isConnecting = false;
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
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

// Graceful shutdown
export const disconnectRedis = async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    logger.info('Redis client gracefully disconnected');
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectRedis();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
  process.exit(0);
});