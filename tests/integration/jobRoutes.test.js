import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/index.js';
import Job from '../../src/models/job.model.js';
import { config } from '../../src/config/index.js';

// Mock dependencies to avoid actual connections during tests
jest.mock('../../src/config/redis.js', () => ({
  connectRedis: jest.fn().mockResolvedValue({}),
  getRedisClient: jest.fn().mockReturnValue({ isOpen: true }),
  disconnectRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue({}),
  disconnectDB: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/jobs/queue.js', () => ({
  createJobQueue: jest.fn().mockReturnValue({
    add: jest.fn().mockResolvedValue({ id: 'test-queue-job-id' }),
    getJob: jest.fn(),
    close: jest.fn(),
  }),
  getJobQueue: jest.fn().mockReturnValue({
    add: jest.fn().mockResolvedValue({ id: 'test-queue-job-id' }),
    getJob: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock('../../src/jobs/workers/emailWorker.js', () => ({
  createEmailWorker: jest.fn().mockReturnValue({}),
}));

jest.mock('../../src/models/job.model.js');

describe('Job Routes Integration Tests', () => {
  let authToken;
  let testJobId;

  beforeAll(() => {
    // Create test JWT token
    authToken = jwt.sign({ user: 'test-user' }, config.jwtSecret, { expiresIn: '1h' });
    testJobId = '507f1f77bcf86cd799439011'; // Valid ObjectId
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: 'wrong-password'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/jobs', () => {
    it('should create a job with valid data and auth', async () => {
      const jobData = global.testHelpers.createTestJobData();
      const mockJob = {
        _id: testJobId,
        ...jobData,
        status: 'active',
        createdAt: new Date(),
      };

      Job.create.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toBe(jobData.name);
      expect(response.body.status).toBe('active');
    });

    it('should reject job creation without auth', async () => {
      const jobData = global.testHelpers.createTestJobData();

      const response = await request(app)
        .post('/api/jobs')
        .send(jobData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid job data', async () => {
      const invalidJobData = {
        name: '', // Invalid: empty name
        data: {} // Invalid: missing required fields
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidJobData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject job with invalid email format', async () => {
      const invalidJobData = global.testHelpers.createTestJobData({
        data: {
          recipient: 'invalid-email',
          subject: 'Test'
        }
      });

      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidJobData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/jobs', () => {
    it('should retrieve jobs with valid auth', async () => {
      const mockJobs = [
        {
          _id: testJobId,
          name: 'sendEmail',
          status: 'completed',
          createdAt: new Date(),
        }
      ];

      Job.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockJobs)
      });

      const response = await request(app)
        .get('/api/jobs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual(mockJobs);
    });

    it('should reject without auth', async () => {
      const response = await request(app)
        .get('/api/jobs');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should retrieve specific job', async () => {
      const mockJob = {
        _id: testJobId,
        name: 'sendEmail',
        status: 'completed',
        createdAt: new Date(),
      };

      Job.findById.mockResolvedValue(mockJob);

      const response = await request(app)
        .get(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockJob);
    });

    it('should return 404 for non-existent job', async () => {
      Job.findById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Job not found');
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    it('should delete job successfully', async () => {
      const mockJob = {
        _id: testJobId,
        name: 'sendEmail',
        status: 'active',
      };

      Job.findById.mockResolvedValue(mockJob);
      Job.findByIdAndDelete.mockResolvedValue(mockJob);

      const response = await request(app)
        .delete(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockJob);
    });
  });

  describe('POST /api/jobs/:id/retry', () => {
    it('should retry failed job', async () => {
      const mockJob = {
        _id: testJobId,
        name: 'sendEmail',
        status: 'failed',
        data: { recipient: 'test@example.com', subject: 'Test' },
      };

      Job.findById.mockResolvedValue(mockJob);
      Job.findByIdAndUpdate.mockResolvedValue({ ...mockJob, status: 'active' });

      const response = await request(app)
        .post(`/api/jobs/${testJobId}/retry`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockJob);
    });

    it('should reject retry of non-failed job', async () => {
      const mockJob = {
        _id: testJobId,
        name: 'sendEmail',
        status: 'active', // Not failed
      };

      Job.findById.mockResolvedValue(mockJob);

      const response = await request(app)
        .post(`/api/jobs/${testJobId}/retry`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500); // Will be handled by error handler
    });
  });

  describe('GET /health', () => {
    it('should return health status without auth', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('memoryUsage');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});