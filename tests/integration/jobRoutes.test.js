import request from 'supertest'; 
import jwt from 'jsonwebtoken'; 
import { app } from '../../src/index.js'; 
import Job from '../../src/models/job.model.js'; 
import { config } from '../../src/config/index.js'; 

// Mock dependencies to avoid actual connections during tests
jest.mock('../../src/config/redis.js', () => ({
  // Mock Redis connection to avoid real database interactions during tests
  connectRedis: jest.fn().mockResolvedValue({}),
  getRedisClient: jest.fn().mockReturnValue({ isOpen: true }),
  disconnectRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/config/db.js', () => ({
  // Mock MongoDB connection to prevent real database operations in tests
  connectDB: jest.fn().mockResolvedValue({}),
  disconnectDB: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/jobs/queue.js', () => ({
  // Mock job queue implementation to simulate queue operations without real processing
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
  // Mock email worker to prevent actual email processing during tests
  createEmailWorker: jest.fn().mockReturnValue({}),
}));

jest.mock('../../src/models/job.model.js'); // Mock job model to simulate database operations

describe('Job Routes Integration Tests', () => {
  // Setup test environment
  let authToken; // JWT token for authenticated requests
  let testJobId; // Test job ID for route parameters

  beforeAll(() => {
    // Initialize test environment
    // Create test JWT token for authenticated requests
    authToken = jwt.sign({ user: 'test-user' }, config.jwtSecret, { expiresIn: '1h' });
    // Use a valid MongoDB ObjectId for testing
    testJobId = '507f1f77bcf86cd799439011';
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/login', () => {
    // Test authentication endpoint
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
      // Test authentication failure with incorrect password
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
      // Test authentication failure with empty request body
      const response = await request(app)
        .post('/api/login')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/jobs', () => {
    // Test job creation endpoint
    it('should create a job with valid data and auth', async () => {
      const jobData = global.testHelpers.createTestJobData(); // Generate test job data
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
      // Test job creation failure without authentication
      const jobData = global.testHelpers.createTestJobData();

      const response = await request(app)
        .post('/api/jobs')
        .send(jobData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid job data', async () => {
      // Test job creation failure with invalid data format
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
      // Test job creation failure with invalid email format
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
    // Test job listing endpoint
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
      // Test job listing failure without authentication
      const response = await request(app)
        .get('/api/jobs');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/jobs/:id', () => {
    // Test job detail endpoint
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
      // Test job detail failure for non-existent job
      Job.findById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Job not found');
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    // Test job deletion endpoint
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
    // Test job retry endpoint
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
      // Test retry failure for non-failed job
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
    // Test health check endpoint
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