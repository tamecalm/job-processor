import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';
import { emailProcessor } from '../processors/emailProcessor.js';

export const createEmailWorker = () => {
  const redisClient = getRedisClient();
  if (!redisClient || !redisClient.isOpen) {
    logger.warn('⚠️ Redis client not available for worker');
    return null; // Return null to avoid crashing
  }

  const worker = new Worker(
    'jobs',
    async (job) => {
      if (job.name === 'sendEmail') {
        return await emailProcessor(job);
      }
      throw new Error(`Unknown job type: ${job.name}`);
    },
    {
      connection: redisClient,
    }
  );

  logger.warn('✅ Email worker initialized');

  worker.on('completed', (job) => logger.warn(`⚠️ Worker completed job ${job.id}`));
  worker.on('failed', (job, err) => logger.warn(`⚠️ Worker failed job ${job.id}: ${err.message}`));

  return worker;
};