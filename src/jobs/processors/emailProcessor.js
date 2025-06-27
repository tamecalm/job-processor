import { logger } from '../../utils/logger.js';
import Job from '../../models/job.model.js';

export const emailProcessor = async (job) => {
  try {
    logger.info('🚀 Processing email job', { 
      jobId: job.id, 
      recipient: job.data.recipient,
      subject: job.data.subject 
    });

    // Simulate email sending with progress updates
    await job.updateProgress(25);
    logger.info('📧 Preparing email...', { jobId: job.id });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await job.updateProgress(50);
    logger.info('📤 Sending email...', { jobId: job.id });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await job.updateProgress(75);
    logger.info('✉️ Email delivery in progress...', { jobId: job.id });
    
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await job.updateProgress(100);

    const result = `Email sent successfully to ${job.data.recipient} with subject: "${job.data.subject}"`;
    logger.info('✅ Email job completed', { 
      jobId: job.id, 
      recipient: job.data.recipient,
      result 
    });

    // Update job status in MongoDB
    await Job.findByIdAndUpdate(job.data.id, {
      status: 'completed',
      result: result,
      completedAt: new Date(),
    });

    return { status: 'success', result };
  } catch (error) {
    logger.error(`❌ Email job ${job.id} failed: ${error.message}`, {
      error: error.message,
      stack: error.stack,
      jobData: job.data,
    });

    // Update job status in MongoDB
    await Job.findByIdAndUpdate(job.data.id, {
      status: 'failed',
      result: error.message,
      failedAt: new Date(),
    });

    throw error;
  }
};