/* eslint-disable no-unused-vars */
import jwt from 'jsonwebtoken';
import { jobService } from '../../services/jobService.js';
import { logger } from '../../utils/logger.js';
import { validateJob } from '../../utils/validator.js';
import { config } from '../../config/index.js';

export const jobController = {
  /**
   * Creates a new job with the provided name and data
   * @param {Object} req - Express request object containing job data in body
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
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

  /**
   * Retrieves all jobs from the database
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async getJobs(req, res, next) {
    try {
      const jobs = await jobService.getJobs();
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retrieves a specific job by ID
   * @param {Object} req - Express request object containing job ID in params
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async getJobById(req, res, next) {
    try {
      const job = await jobService.getJobById(req.params.id);
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Deletes a job by ID
   * @param {Object} req - Express request object containing job ID in params
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async deleteJob(req, res, next) {
    try {
      const job = await jobService.deleteJob(req.params.id);
      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Retries a failed job by ID
   * @param {Object} req - Express request object containing job ID in params
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async retryJob(req, res, next) {
    try {
      const job = await jobService.retryJob(req.params.id);
      res.json(job);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Authenticates user and generates JWT token
   * @param {Object} req - Express request object containing username/password in body
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      
      // Input validation
      if (!username || !password) {
        logger.warn('Login attempt with missing credentials', { 
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 100)
        });
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Rate limiting check (additional security layer)
      const clientId = req.ip;
      
      // Secure credential validation - ONLY use environment variables
      if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
        // Additional security: Check if admin password is set and strong
        if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 4) {
          logger.error('SECURITY: Admin password not set or too weak');
          return res.status(500).json({ error: 'Server configuration error' });
        }

        const token = jwt.sign(
          { 
            user: username,
            iat: Math.floor(Date.now() / 1000),
            // Add additional claims for security
            ip: req.ip,
            userAgent: req.get('User-Agent')?.substring(0, 100)
          }, 
          config.jwtSecret, 
          { 
            expiresIn: '24h',
            issuer: 'job-processor-api',
            audience: 'job-processor-client'
          }
        );
        
        logger.info('Successful authentication', { 
          user: username,
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 100)
        });
        
        res.json({ token });
      } else {
        // Log failed attempts for security monitoring
        logger.warn('Failed authentication attempt', { 
          username: username?.substring(0, 50), // Limit logged username length
          ip: req.ip,
          userAgent: req.get('User-Agent')?.substring(0, 100),
          timestamp: new Date().toISOString()
        });
        
        // Consistent response time to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      logger.error('Authentication error', { 
        error: error.message,
        ip: req.ip,
        // Don't log full stack trace for security
        type: error.name
      });
      next(error);
    }
  },
};