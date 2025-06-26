import { logger } from '../../utils/logger.js';
import Job from '../../models/job.model.js';

export const emailProcessor = async (job) => {
  try {
    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logger.info(`Processed email job ${job.id} for ${job.data.email}`);

    // Update job status in MongoDB
    await Job.findByIdAndUpdate(job.id, {
      status: 'completed',
      result: `Email sent to ${job.data.email}`,
      completedAt: new Date(),
    });

    return { status: 'success', result: `Email sent to ${job.data.email}` };
  } catch (error) {
    logger.error(`Email job ${job.id} failed: ${error.message}`);
    await Job.findByIdAndUpdate(job.id, {
      status: 'failed',
      result: error.message,
      failedAt: new Date(),
    });
    throw error;
  }
};