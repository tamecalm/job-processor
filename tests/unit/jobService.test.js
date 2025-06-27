import { jobService } from '../../src/services/jobService.js';
import Job from '../../src/models/job.model.js';
import { createJobQueue } from '../../src/jobs/queue.js';
import mongoose from 'mongoose';

// Mock dependencies
jest.mock('../../src/models/job.model.js');
jest.mock('../../src/jobs/queue.js');
jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }
}));

describe('JobService', () => {
  let mockQueue;
  let mockJob;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock queue
    mockQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      close: jest.fn(),
    };
    
    // Mock job
    mockJob = {
      _id: new mongoose.Types.ObjectId(),
      name: 'sendEmail',
      data: { recipient: 'test@example.com', subject: 'Test' },
      status: 'active',
      createdAt: new Date(),
    };

    createJobQueue.mockReturnValue(mockQueue);
  });

  describe('createJob', () => {
    it('should create a job successfully', async () => {
      // Arrange
      Job.create.mockResolvedValue(mockJob);
      mockQueue.add.mockResolvedValue({ id: 'queue-job-id' });

      // Act
      const result = await jobService.createJob('sendEmail', mockJob.data);

      // Assert
      expect(Job.create).toHaveBeenCalledWith({
        name: 'sendEmail',
        data: mockJob.data,
        status: 'active'
      });
      
      expect(mockQueue.add).toHaveBeenCalledWith(
        'sendEmail',
        { ...mockJob.data, id: mockJob._id },
        expect.objectContaining({
          jobId: mockJob._id.toString(),
          delay: 0,
          attempts: 3,
        })
      );
      
      expect(result).toEqual(mockJob);
    });

    it('should handle queue initialization failure', async () => {
      // Arrange
      createJobQueue.mockReturnValue(null);

      // Act & Assert
      await expect(jobService.createJob('sendEmail', mockJob.data))
        .rejects.toThrow('Job queue not initialized');
    });

    it('should cleanup MongoDB job if queue addition fails', async () => {
      // Arrange
      Job.create.mockResolvedValue(mockJob);
      Job.findByIdAndDelete.mockResolvedValue(mockJob);
      mockQueue.add.mockRejectedValue(new Error('Queue error'));

      // Act & Assert
      await expect(jobService.createJob('sendEmail', mockJob.data))
        .rejects.toThrow('Failed to queue job: Queue error');
      
      expect(Job.findByIdAndDelete).toHaveBeenCalledWith(mockJob._id);
    });
  });

  describe('getJobs', () => {
    it('should retrieve all jobs', async () => {
      // Arrange
      const mockJobs = [mockJob, { ...mockJob, _id: new mongoose.Types.ObjectId() }];
      Job.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockJobs)
      });

      // Act
      const result = await jobService.getJobs();

      // Assert
      expect(Job.find).toHaveBeenCalled();
      expect(result).toEqual(mockJobs);
    });

    it('should handle database errors', async () => {
      // Arrange
      Job.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      // Act & Assert
      await expect(jobService.getJobs()).rejects.toThrow('Database error');
    });
  });

  describe('getJobById', () => {
    it('should retrieve job by ID', async () => {
      // Arrange
      Job.findById.mockResolvedValue(mockJob);

      // Act
      const result = await jobService.getJobById(mockJob._id);

      // Assert
      expect(Job.findById).toHaveBeenCalledWith(mockJob._id);
      expect(result).toEqual(mockJob);
    });

    it('should throw error if job not found', async () => {
      // Arrange
      Job.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(jobService.getJobById('nonexistent-id'))
        .rejects.toThrow('Job not found');
    });
  });

  describe('deleteJob', () => {
    it('should delete job successfully', async () => {
      // Arrange
      const mockQueueJob = { remove: jest.fn().mockResolvedValue() };
      Job.findById.mockResolvedValue(mockJob);
      Job.findByIdAndDelete.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(mockQueueJob);

      // Act
      const result = await jobService.deleteJob(mockJob._id);

      // Assert
      expect(mockQueue.getJob).toHaveBeenCalledWith(mockJob._id);
      expect(mockQueueJob.remove).toHaveBeenCalled();
      expect(Job.findByIdAndDelete).toHaveBeenCalledWith(mockJob._id);
      expect(result).toEqual(mockJob);
    });

    it('should handle queue job not found', async () => {
      // Arrange
      Job.findById.mockResolvedValue(mockJob);
      Job.findByIdAndDelete.mockResolvedValue(mockJob);
      mockQueue.getJob.mockResolvedValue(null);

      // Act
      const result = await jobService.deleteJob(mockJob._id);

      // Assert
      expect(Job.findByIdAndDelete).toHaveBeenCalledWith(mockJob._id);
      expect(result).toEqual(mockJob);
    });
  });

  describe('retryJob', () => {
    it('should retry failed job successfully', async () => {
      // Arrange
      const failedJob = { ...mockJob, status: 'failed' };
      Job.findById.mockResolvedValue(failedJob);
      Job.findByIdAndUpdate.mockResolvedValue(failedJob);
      mockQueue.add.mockResolvedValue({ id: 'retry-queue-job-id' });

      // Act
      const result = await jobService.retryJob(mockJob._id);

      // Assert
      expect(mockQueue.add).toHaveBeenCalledWith(
        failedJob.name,
        { ...failedJob.data, id: failedJob._id },
        expect.objectContaining({
          jobId: failedJob._id.toString(),
          delay: 0,
        })
      );
      
      expect(Job.findByIdAndUpdate).toHaveBeenCalledWith(mockJob._id, {
        status: 'active',
        result: null,
        failedAt: null
      });
      
      expect(result).toEqual(failedJob);
    });

    it('should throw error if job is not in failed state', async () => {
      // Arrange
      Job.findById.mockResolvedValue(mockJob); // status is 'active'

      // Act & Assert
      await expect(jobService.retryJob(mockJob._id))
        .rejects.toThrow('Job is not in failed state');
    });
  });
});