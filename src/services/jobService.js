import { createJobQueue, getJobQueue } from '../jobs/queue.js';
import Job from '../models/job.model.js';
import { logger } from '../utils/logger.js';

export const jobService = {
  async createJob(name, data) {
    let job = null;
    try {
      logger.info('🚀 Creating job', { name, data });

      // Get or create the job queue
      let queue = getJobQueue();
      if (!queue) {
        queue = createJobQueue();
      }
      
      if (!queue) {
        logger.error('❌ Job queue not initialized');
        throw new Error('Job queue not initialized');
      }

      // Create job in MongoDB first
      job = await Job.create({ name, data, status: 'active' });
      logger.info('✅ Job saved to MongoDB', { jobId: job._id });

      // Add job to Redis queue with increased timeout and better error handling
      try {
        const queueJob = await queue.add(
          name, 
          { ...data, id: job._id }, 
          { 
            jobId: job._id.toString(),
            delay: 0,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );

        logger.info(`✅ Created job ${job._id} with queue ID ${queueJob.id}`);
        return job;

      } catch (queueError) {
        logger.error('❌ Failed to add job to queue', {
          error: queueError.message,
          stack: queueError.stack,
          jobId: job._id,
        });

        // Clean up MongoDB job if queue addition fails
        await Job.findByIdAndDelete(job._id);
        logger.info('🧹 Cleaned up MongoDB job', { jobId: job._id });
        
        throw new Error(`Failed to queue job: ${queueError.message}`);
      }

    } catch (error) {
      logger.error('❌ Failed to create job', { 
        error: error.message, 
        stack: error.stack 
      });

      // Clean up MongoDB job if it was created
      if (job && job._id) {
        try {
          await Job.findByIdAndDelete(job._id);
          logger.info('🧹 Cleaned up MongoDB job', { jobId: job._id });
        } catch (cleanupError) {
          logger.error('❌ Failed to cleanup MongoDB job', {
            error: cleanupError.message,
            jobId: job._id,
          });
        }
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
      logger.error('❌ Failed to get jobs', { 
        error: error.message, 
        stack: error.stack 
      });
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
      logger.error('❌ Failed to get job', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  },

  async deleteJob(id) {
    try {
      const queue = getJobQueue() || createJobQueue();
      if (!queue) {
        logger.error('❌ Job queue not initialized');
        throw new Error('Job queue not initialized');
      }

      const job = await Job.findById(id);
      if (!job) {
        logger.warn('⚠️ Job not found', { jobId: id });
        throw new Error('Job not found');
      }

      // Try to remove from queue
      try {
        const queueJob = await queue.getJob(id);
        if (queueJob) {
          await queueJob.remove();
          logger.info('✅ Removed job from queue', { jobId: id });
        }
      } catch (queueError) {
        logger.warn('⚠️ Failed to remove job from queue', {
          error: queueError.message,
          jobId: id,
        });
      }

      // Remove from MongoDB
      await Job.findByIdAndDelete(id);
      logger.info(`✅ Deleted job ${id}`);
      return job;
    } catch (error) {
      logger.error('❌ Failed to delete job', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  },

  async retryJob(id) {
    try {
      const queue = getJobQueue() || createJobQueue();
      if (!queue) {
        logger.error('❌ Job queue not initialized');
        throw new Error('Job queue not initialized');
      }

      const job = await Job.findById(id);
      if (!job) {
        logger.warn('⚠️ Job not found', { jobId: id });
        throw new Error('Job not found');
      }

      if (job.status !== 'failed') {
        logger.warn('⚠️ Job is not in failed state', { jobId: id, status: job.status });
        throw new Error('Job is not in failed state');
      }

      // Add job back to queue
      const queueJob = await queue.add(
        job.name, 
        { ...job.data, id: job._id }, 
        { 
          jobId: job._id.toString(),
          delay: 0,
        }
      );

      // Update job status in MongoDB
      await Job.findByIdAndUpdate(id, { 
        status: 'active', 
        result: null, 
        failedAt: null 
      });

      logger.info(`✅ Retried job ${id} with queue ID ${queueJob.id}`);
      return job;
    } catch (error) {
      logger.error('❌ Failed to retry job', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  },
};