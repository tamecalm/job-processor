import supertest from 'supertest';
import { app } from './../../index.js';
import { Job } from './../../models/job.model.js';
import jwt from 'jsonwebtoken';
import { config } from './../../config/index.js';

describe('Job Routes', () => {
  let token;

  beforeAll(async () => {
    token = jwt.sign({ user: 'test' }, config.jwtSecret);
  });

  describe('POST /api/jobs', () => {
    it('should create a job with valid data', async () => {
      const jobData = {
        name: 'sendEmail',
        data: { email: 'test@example.com', content: 'Hello' },
      };

      const response = await supertest(app)
        .post('/api/jobs').post('/jobs')
        .set('Authorization', 'Bearer ' + token)
        .send(jobData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.name).toEqual('sendEmail');
      expect(response.body.status).toEqual('active');
    });

    it('should return 400 for invalid data', async () => {
      const invalidJobData = { name: 'invalid' };

      await supertest(app)
        .post('/api/jobs')
        .set('Authorization', 'Bearer ' + token)
        .send(invalidJobData)
        .expect(400);
    });
  });
});