import { Queue, QueueEvents } from 'bullmq';
import { logger } from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

export const createJobQueue = () => {
  const redisClient = getRedisClient();
  if (!redisClient) {
    logger.error('❌ Redis client not available for job queue');
    throw new Error('Redis client not initialized');
  }

  const jobQueue = new Queue('jobs', {
    connection: redisClient,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  });

  const queueEvents = new QueueEvents('jobs', { connection: redisClient });
  queueEvents.on('completed', ({ jobId }) => logger.info(`Job ${jobId} completed`));
  queueEvents.on('failed', ({ jobId, failedReason }) => logger.error(`Job ${jobId} failed: ${failedReason}`));

  return jobQueue;
};