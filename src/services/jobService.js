import { jobQueue } from '../jobs/queue.js';
import Job from '../models/job.model.js';
import { logger } from '../utils/logger.js';

export const jobService = {
  async createJob(name, data) {
    const job = await Job.create({ name, data, status: 'active' });
    const queueJob = await jobQueue.add(name, { ...data, id: job._id }, { jobId: job._id.toString() });
    logger.info(`Created job ${job._id} with queue ID ${queueJob.id}`);
    return job;
  },

  async getJobs() {
    return await Job.find().sort({ createdAt: -1 });
  },

  async getJobById(id) {
    return await Job.findById(id);
  },

  async deleteJob(id) {
    const job = await Job.findById(id);
    if (!job) throw new Error('Job not found');
    await jobQueue.remove(id);
    await job.remove();
    logger.info(`Deleted job ${id}`);
    return job;
  },

  async retryJob(id) {
    const job = await Job.findById(id);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'failed') throw new Error('Job is not in failed state');
    const queueJob = await jobQueue.add(job.name, { ...job.data, id: job._id }, { jobId: job._id.toString() });
    await Job.findByIdAndUpdate(id, { status: 'active', result: null, failedAt: null });
    logger.info(`Retried job ${id} with queue ID ${queueJob.id}`);
    return job;
  },
};