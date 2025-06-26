import { jobService } from './../../services/jobService.js';
import { Job } from './../../models/job.model.js';
import { jobQueue } from './../../jobs/queue.js';
import mongoose from 'mongoose';

jest.mock('./../../models/job.model.js');
jest.mock('./../../jobs/queue.js');

describe('jobService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a job', async () => {
    const mockJob = {
      _id: mongoose.Types.ObjectId('123'),
      name: 'sendEmail',
      data: { email: 'test@example.com', content: 'Hello' },
      status: 'active'
    };
    Job.create.mockResolvedValue(mockJob);
    jobQueue.add.mockResolvedValue({ id: '123' });

    const job = await jobService.createJob('sendEmail', mockJob.data);

    expect(Job.create).toHaveBeenCalledWith({
      name: 'sendEmail',
      data: mockJob.data,
      status: 'active'
    });
    expect(jobQueue.add).toHaveBeenCalledWith(
      'sendEmail',
      { ...mockJob.data, id: '123' },
      { jobId: '123' }
    );
    expect(job).toEqual(mockJob);
  });

  it('should get all jobs', async () => {
    const mockJobs = [
      { _id: '123', name: 'sendEmail', status: 'active' },
      { _id: '456', name: 'sendEmail', status: 'completed' },
    ];
    Job.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue(mockJobs)
    });

    const jobs = await jobService.getJobs();

    expect(Job.find).toHaveBeenCalled();
    expect(jobs).toEqual(mockJobs);
  });
});