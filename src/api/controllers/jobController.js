import { jobService } from '../../services/jobService.js';
import { logger } from '../../utils/logger.js';
import { validateJob } from '../../utils/validator.js';

export const jobController = {
  async createJob(req, res, next) {
    try {
      const { error } = validateJob(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });
      const job = await jobService.createJob(req.body.name, req.body.data);
      res.status(201).json(job);
    } catch (error) {
      next(error);
    }
  },

  async getJobs(req, res, next) {
    try {
      const jobs = await jobService.getJobs();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  },

  async getJobById(req, res, next) {
    try {
      const job = await jobService.getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  async deleteJob(req, res, next) {
    try {
      const job = await jobService.deleteJob(req.params.id);
      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  async retryJob(req, res, next) {
    try {
      const job = await jobService.retryJob(req.params.id);
      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      // Simplified login for demo (replace with proper auth in production)
      const { username, password } = req.body;
      if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
        const jwt = require('jsonwebtoken');
        const { username, password } = req.params;
        const token = jwt.sign({ user: username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      next(error);
    }
  },
};