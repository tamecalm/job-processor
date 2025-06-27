import { Queue, QueueEvents } from 'bullmq';
import { logger } from '../utils/logger.js';
import { getRedisClient } from '../config/redis.js';

export const createJobQueue = () => {
  const redisClient = getRedisClient();
  if (!redisClient || !redisClient.isOpen) {
    logger.warn('⚠️ Redis client not available or disconnected for job queue');
    return null; // Return null instead of throwing to avoid server crash
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

  logger.warn('✅ Job queue initialized');

  const queueEvents = new QueueEvents('jobs', { connection: redisClient });
  queueEvents.on('completed', ({ jobId }) => logger.warn(`⚠️ Job ${jobId} completed`));
  queueEvents.on('failed', ({ jobId, failedReason }) => logger.warn(`⚠️ Job ${jobId} failed: ${failedReason}`));

  return jobQueue;
};