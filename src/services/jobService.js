import { createJobQueue } from '../jobs/queue.js';
import Job from '../models/job.model.js';
import { logger } from '../utils/logger.js';
import { getRedisClient, connectRedis } from '../config/redis.js';

export const jobService = {
  async createJob(name, data) {
    let job = null;
    try {
      logger.warn('🚀 Creating job', { name, data });
      let redisClient = getRedisClient();
      if (!redisClient || !redisClient.isOpen) {
        logger.warn('⚠️ Redis client not ready, attempting reconnect');
        redisClient = await connectRedis();
      }
      const queue = createJobQueue();
      if (!queue) {
        logger.warn('⚠️ Job queue not initialized');
        throw new Error('Job queue not initialized');
      }
      job = await Job.create({ name, data, status: 'active' });
      logger.warn('✅ Job saved to MongoDB', { jobId: job._id });

      let queueJob = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          queueJob = await Promise.race([
            queue.add(name, { ...data, id: job._id }, { jobId: job._id.toString() }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Queue add timed out')), 60000)),
          ]);
          break;
        } catch (error) {
          logger.warn('⚠️ Queue add attempt failed', { attempt, error: error.message });
          if (attempt === 3) throw error;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      logger.warn(`✅ Created job ${job._id} with queue ID ${queueJob.id}`);
      return job;
    } catch (error) {
      logger.warn('⚠️ Failed to create job', { error: error.message, stack: error.stack });
      if (job) {
        await Job.findByIdAndDelete(job._id);
        logger.warn('🧹 Cleaned up MongoDB job', { jobId: job._id });
      }
      throw error;
    }
  },

  async getJobs() {
    try {
      const jobs = await Job.find().sort({ createdAt: -1 });
      logger.warn('✅ Retrieved jobs', { count: jobs.length });
      return jobs;
    } catch (error) {
      logger.warn('⚠️ Failed to get jobs', { error: error.message, stack: error.stack });
      throw error;
    }
  },

  async getJobById(id) {
    try {
      const job = await Job.findById(id);
      if (!job) {
        logger.warn('⚠️ Job not found', { jobId: id });
        throw new Error('Job not found');
      }
      logger.warn('✅ Retrieved job', { jobId: id });
      return job;
    } catch (error) {
      logger.warn('⚠️ Failed to get job', { error: error.message, stack: error.stack });
      throw error;
    }
  },

  async deleteJob(id) {
    try {
      const queue = createJobQueue();
      if (!queue) {
        logger.warn('⚠️ Job queue not initialized');
        throw new Error('Job queue not initialized');
      }
      const job = await Job.findById(id);
      if (!job) {
        logger.warn('⚠️ Job not found', { jobId: id });
        throw new Error('Job not found');
      }
      const queueJob = await queue.getJob(id);
      if (queueJob) await queueJob.remove();
      await job.remove();
      logger.warn(`✅ Deleted job ${id}`);
      return job;
    } catch (error) {
      logger.warn('⚠️ Failed to delete job', { error: error.message, stack: error.stack });
      throw error;
    }
  },

  async retryJob(id) {
    try {
      const queue = createJobQueue();
      if (!queue) {
        logger.warn('⚠️ Job queue not initialized');
        throw new Error('Job queue not initialized');
      }
      const job = await Job.findById(id);
      if (!job) {
        logger.warn('⚠️ Job not found', { jobId: id });
        throw new Error('Job not found');
      }
      if (job.status !== 'failed') {
        logger.warn('⚠️ Job is not in failed state', { jobId: id });
        throw new Error('Job is not in failed state');
      }
      const queueJob = await queue.add(job.name, { ...job.data, id: job._id }, { jobId: job._id.toString() });
      await Job.findByIdAndUpdate(id, { status: 'active', result: null, failedAt: null });
      logger.warn(`✅ Retried job ${id} with queue ID ${queueJob.id}`);
      return job;
    } catch (error) {
      logger.warn('⚠️ Failed to retry job', { error: error.message, stack: error.stack });
      throw error;
    }
  },
};