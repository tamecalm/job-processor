import { createClient } from 'redis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient;

export const connectRedis = async () => {
  redisClient = createClient({ url: config.redisUri });
  redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
  await redisClient.connect();
  logger.info('Redis connected successfully');
  return redisClient;
};

export const getRedisClient = () => redisClient;