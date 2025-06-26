import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { getRedisClient } from '../../config/redis.js';
import { emailProcessor } from '../processors/emailProcessor.js';

export const createEmailWorker = () => {
  const worker = new Worker(
    'jobs',
    async (job) => {
      if (job.name === 'sendEmail') {
        return await emailProcessor(job);
      }
      throw new Error(`Unknown job type: ${job.name}`);
    },
    { connection: getRedisClient() }
  );

  worker.on('completed', (job) => logger.info(`Worker completed job ${job.id}`));
  worker.on('failed', (job, err) => logger.error(`Worker failed job ${job.id}: ${err.message}`));

  return worker;
};