import { createJobQueue } from '../jobs/queue.js';
import Job from '../models/job.model.js';
import { logger } from '../utils/logger.js';

export const jobService = {
  async createJob(name, data) {
    let job = null; // Define job
    try {
      logger.info('🚀 Creating job', { name, data });
      const queue = createJobQueue();
      job = await Job.create({ name, data, status: 'active' });
      logger.info('✅ Job saved to MongoDB', { jobId: job._id });

      // Add timeout for queue.add
      const queueJob = await Promise.race([
        queue.add(name, { ...data, id: job._id }, { jobId: job._id.toString() }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Queue add timed out')), 10000)),
      ]);
      logger.info(`Created job ${job._id} with queue ID ${queueJob.id}`);
      return job;
    } catch (error) {
      logger.error('❌ Failed to create job', { error: error.message, stack: error.stack });
      if (job) {
        await Job.findByIdAndDelete(job._id);
        logger.info('🧹 Cleaned up MongoDB job', { jobId: job._id });
      }
      throw error;
    }
  },

  async getJobs() {
    try {
      const jobs = await Job.find().sort({ createdAt: -1 });
      logger.info('✅ Retrieved jobs', { count: jobs.length });
      return jobs;
    } catch (error) {
      logger.error('❌ Failed to get jobs', { error: error.message, stack: error.stack });
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
      logger.info('✅ Retrieved job', { jobId: id });
      return job;
    } catch (error) {
      logger.error('❌ Failed to get job', { error: error.message, stack: error.stack });
      throw error;
    }
  },

  async deleteJob(id) {
    try {
      const queue = createJobQueue();
      const job = await Job.findById(id);
      if (!job) {
        logger.warn('⚠️ Job not found', { jobId: id });
        throw new Error('Job not found');
      }
      const queueJob = await queue.getJob(id);
      if (queueJob) await queueJob.remove();
      await job.remove();
      logger.info(`Deleted job ${id}`);
      return job;
    } catch (error) {
      logger.error('❌ Failed to delete job', { error: error.message, stack: error.stack });
      throw error;
    }
  },

  async retryJob(id) {
    try {
      const queue = createJobQueue();
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
      logger.info(`Retried job ${id} with queue ID ${queueJob.id}`);
      return job;
    } catch (error) {
      logger.error('❌ Failed to retry job', { error: error.message, stack: error.stack });
      throw error;
    }
  },
};