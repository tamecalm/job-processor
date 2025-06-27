import { Worker } from 'bullmq';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { emailProcessor } from '../processors/emailProcessor.js';

let emailWorker = null;

export const createEmailWorker = () => {
  // Return existing worker if already created
  if (emailWorker) {
    return emailWorker;
  }

  try {
    // Create Redis connection config for BullMQ Worker
    const redisConfig = {
      host: config.redisUri.includes('upstash.io') ? config.redisUri.split('@')[1].split(':')[0] : 'localhost',
      port: config.redisUri.includes('upstash.io') ? parseInt(config.redisUri.split(':').pop()) : 6379,
      password: config.redisUri.includes('upstash.io') ? config.redisUri.split('//')[1].split(':')[1].split('@')[0] : undefined,
      username: config.redisUri.includes('upstash.io') ? config.redisUri.split('//')[1].split(':')[0] : undefined,
      tls: config.redisUri.startsWith('rediss://') ? {} : undefined,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null, // Fix BullMQ warning
      lazyConnect: true,
      connectTimeout: 30000,
      commandTimeout: 30000,
    };

    logger.info('🚀 Creating BullMQ worker with Redis config');

    emailWorker = new Worker(
      'jobs',
      async (job) => {
        logger.info('🔄 Processing job', { 
          jobId: job.id, 
          jobName: job.name,
          data: job.data 
        });

        if (job.name === 'sendEmail') {
          return await emailProcessor(job);
        }
        throw new Error(`Unknown job type: ${job.name}`);
      },
      {
        connection: redisConfig,
        concurrency: 5,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    emailWorker.on('completed', (job, result) => {
      logger.info(`✅ Worker completed job ${job.id}`, { result });
    });

    emailWorker.on('failed', (job, err) => {
      logger.error(`❌ Worker failed job ${job?.id}: ${err.message}`, {
        error: err.message,
        stack: err.stack,
      });
    });

    emailWorker.on('error', (err) => {
      logger.error('❌ Worker error', {
        error: err.message,
        stack: err.stack,
      });
    });

    logger.info('✅ Email worker initialized successfully');
    return emailWorker;

  } catch (error) {
    logger.error('❌ Failed to create email worker', {
      error: error.message,
      stack: error.stack,
    });
    emailWorker = null;
    return null;
  }
};

export const getEmailWorker = () => {
  return emailWorker;
};

export const closeWorker = async () => {
  try {
    if (emailWorker) {
      await emailWorker.close();
      emailWorker = null;
    }
    logger.info('🔌 Email worker closed successfully');
  } catch (error) {
    logger.error('❌ Error closing email worker', {
      error: error.message,
      stack: error.stack,
    });
  }
};