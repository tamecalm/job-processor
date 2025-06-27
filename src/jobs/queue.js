import { Queue, QueueEvents } from 'bullmq';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

let jobQueue = null;
let queueEvents = null;

export const createJobQueue = () => {
  // Return existing queue if already created
  if (jobQueue) {
    return jobQueue;
  }

  try {
    // Create Redis connection config for BullMQ
    const redisConfig = {
      host: config.redisUri.includes('upstash.io') ? config.redisUri.split('@')[1].split(':')[0] : 'localhost',
      port: config.redisUri.includes('upstash.io') ? parseInt(config.redisUri.split(':').pop()) : 6379,
      password: config.redisUri.includes('upstash.io') ? config.redisUri.split('//')[1].split(':')[1].split('@')[0] : undefined,
      username: config.redisUri.includes('upstash.io') ? config.redisUri.split('//')[1].split(':')[0] : undefined,
      tls: config.redisUri.startsWith('rediss://') ? {} : undefined,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 30000,
      commandTimeout: 30000,
    };

    logger.info('🚀 Creating BullMQ queue with Redis config', {
      host: redisConfig.host,
      port: redisConfig.port,
      tls: !!redisConfig.tls,
    });

    jobQueue = new Queue('jobs', {
      connection: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    // Create queue events
    queueEvents = new QueueEvents('jobs', { 
      connection: redisConfig 
    });

    queueEvents.on('completed', ({ jobId }) => {
      logger.info(`✅ Job ${jobId} completed`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`❌ Job ${jobId} failed: ${failedReason}`);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.info(`🔄 Job ${jobId} progress: ${JSON.stringify(data)}`);
    });

    logger.info('✅ Job queue and events initialized successfully');
    return jobQueue;

  } catch (error) {
    logger.error('❌ Failed to create job queue', {
      error: error.message,
      stack: error.stack,
    });
    jobQueue = null;
    return null;
  }
};

export const getJobQueue = () => {
  return jobQueue;
};

export const closeQueue = async () => {
  try {
    if (queueEvents) {
      await queueEvents.close();
      queueEvents = null;
    }
    if (jobQueue) {
      await jobQueue.close();
      jobQueue = null;
    }
    logger.info('🔌 Job queue closed successfully');
  } catch (error) {
    logger.error('❌ Error closing job queue', {
      error: error.message,
      stack: error.stack,
    });
  }
};