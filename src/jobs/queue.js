import { Queue, QueueEvents } from 'bullmq';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

let jobQueue = null;
let queueEvents = null;

export const createJobQueue = () => {
  // Return existing queue if already created
  if (jobQueue) {
    logger.debug('Job queue already exists, returning existing instance');
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
      maxRetriesPerRequest: null,
      lazyConnect: true,
      connectTimeout: 30000,
      commandTimeout: 30000,
    };

    logger.debug('Creating BullMQ queue');

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

    // Create queue events with minimal logging
    queueEvents = new QueueEvents('jobs', { 
      connection: redisConfig 
    });

    // Only log important job events
    queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`Job completed`, { jobId });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.warn(`Job failed`, { 
        jobId, 
        reason: failedReason?.substring(0, 200) || 'Unknown error' // Limit error message length
      });
    });

    // Only log progress for long-running jobs (optional)
    queueEvents.on('progress', ({ jobId, data }) => {
      if (data && typeof data === 'object' && data.percentage) {
        logger.debug(`Job progress`, { 
          jobId, 
          progress: data.percentage 
        });
      }
    });

    // Log stalled jobs (important for monitoring)
    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job stalled`, { jobId });
    });

    logger.debug('Job queue and events initialized');
    return jobQueue;

  } catch (error) {
    logger.error('Failed to create job queue', {
      error: error.message,
      code: error.code || 'UNKNOWN',
    });
    jobQueue = null;
    return null;
  }
};

export const getJobQueue = () => {
  if (!jobQueue) {
    logger.debug('Job queue not initialized');
  }
  return jobQueue;
};

export const closeQueue = async () => {
  try {
    if (queueEvents) {
      await queueEvents.close();
      queueEvents = null;
      logger.debug('Queue events closed');
    }
    if (jobQueue) {
      await jobQueue.close();
      jobQueue = null;
      logger.debug('Job queue closed');
    }
    logger.info('Job queue closed successfully');
  } catch (error) {
    logger.error('Error closing job queue', {
      error: error.message,
    });
  }
};

// Helper function to add jobs with logging
export const addJob = async (jobName, jobData, options = {}) => {
  try {
    if (!jobQueue) {
      throw new Error('Job queue not initialized');
    }
    
    const job = await jobQueue.add(jobName, jobData, options);
    logger.debug('Job added to queue', { 
      jobId: job.id, 
      jobName,
      priority: options.priority || 'normal'
    });
    
    return job;
  } catch (error) {
    logger.error('Failed to add job to queue', {
      jobName,
      error: error.message,
    });
    throw error;
  }
};

// Helper function to get queue stats
export const getQueueStats = async () => {
  try {
    if (!jobQueue) {
      return null;
    }
    
    const [waiting, active, completed, failed] = await Promise.all([
      jobQueue.getWaiting(),
      jobQueue.getActive(),
      jobQueue.getCompleted(),
      jobQueue.getFailed(),
    ]);
    
    const stats = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
    
    logger.debug('Queue stats retrieved', stats);
    return stats;
  } catch (error) {
    logger.error('Failed to get queue stats', {
      error: error.message,
    });
    return null;
  }
};