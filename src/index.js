/* eslint-disable no-unused-vars */
import express from 'express'; // Web framework for building APIs
import { createBullBoard } from '@bull-board/api'; // Dashboard for monitoring job queues
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js'; // Adapter for BullMQ integration
import { ExpressAdapter } from '@bull-board/express'; // Express adapter for Bull Board
import dotenv from 'dotenv'; // Load environment variables from .env file
import cors from 'cors'; // Enable Cross-Origin Resource Sharing
import helmet from 'helmet'; // Security middleware for HTTP headers
import jobRoutes from './api/routes/jobRoutes.js'; // API routes for job management
import { connectRedis, getRedisClient } from './config/redis.js'; // Redis connection utilities
import { connectDB } from './config/db.js'; // MongoDB connection utility
import { createJobQueue } from './jobs/queue.js'; // Job queue initialization
import { createEmailWorker } from './jobs/workers/emailWorker.js'; // Email processing worker
import { authMiddleware } from './api/middlewares/auth.js'; // Authentication middleware
import { errorHandler } from './api/middlewares/errorHandler.js'; // Global error handler
import { createRateLimiter } from './api/middlewares/rateLimiter.js'; // Rate limiting middleware
import { setupSwagger } from './config/swagger.js'; // Swagger UI configuration
import { logger } from './utils/logger.js'; // Logging utility

dotenv.config();

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Timeout wrappers for debugging long hangs
const withTimeout = (promise, timeout, label) => {
  // Utility to add timeout to promises for debugging long-running operations
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), timeout)
    ),
  ]);
};

async function startServer() {
  try {
    // Initialize server - connect to Redis, MongoDB, setup queues, and start the server
    logger.start('Starting Redis connection...');
    let redisConnected = false;
    let jobQueue = null;
    
    try {
      // Attempt to connect to Redis with a timeout
      await withTimeout(connectRedis(), 15000, 'Redis connection');
      redisConnected = true;
      logger.success('Redis connected successfully');
    } catch (redisError) {
      logger.fail('Redis connection failed', { error: redisError.message });
    }

    logger.start('Connecting to MongoDB...');
    try {
      // Connect to MongoDB with a timeout
      await withTimeout(connectDB(), 10000, 'MongoDB connection');
      logger.success('MongoDB connected successfully');
    } catch (mongoError) {
      logger.fail('MongoDB connection failed', { error: mongoError.message });
      throw mongoError;
    }

    logger.start('Initializing rate limiter...');
    // Rate limiter configuration (60 requests per minute)
    // Disabled by default - uncomment app.use line to enable
    const rateLimiter = createRateLimiter({ points: 60, duration: 60 });
    // app.use('/api/jobs', rateLimiter);
    logger.success('Rate limiter initialized');

    if (redisConnected) {
      logger.start('Initializing job queue and worker...');
      try {
        // Initialize job queue and email worker
        jobQueue = createJobQueue();
        if (jobQueue) {
          logger.success('Job queue initialized');
          
          // Initialize email processing worker
          const worker = createEmailWorker();
          if (worker) {
            logger.success('Email worker initialized');
          } else {
            logger.warn('Email worker initialization failed');
          }
        } else {
          logger.warn('Job queue initialization failed, skipping worker');
          redisConnected = false;
        }
      } catch (queueError) {
        logger.fail('Failed to initialize job queue or worker', { error: queueError.message });
        redisConnected = false;
      }
    } else {
      logger.warn('Skipping job queue due to Redis failure');
    }

    if (redisConnected && jobQueue) {
      logger.start('Setting up Bull Board dashboard...');
      try {
        // Initialize Bull Board dashboard for monitoring job queues
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/dashboard');
        createBullBoard({
          queues: [new BullMQAdapter(jobQueue)],
          serverAdapter,
        });
        app.use('/dashboard', authMiddleware, serverAdapter.getRouter());
        logger.success('Bull Board dashboard enabled at /dashboard');
      } catch (bullBoardError) {
        logger.fail('Failed to set up Bull Board', { error: bullBoardError.message });
      }
    } else {
      logger.warn('Bull Board disabled due to Redis or queue issue');
    }

    logger.start('Setting up Swagger API documentation...');
    // Setup Swagger UI for API documentation
    setupSwagger(app, '/api-docs');

    logger.start('Registering API routes...');
    // Register API routes and global error handler
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    logger.success('API routes configured');

    // Health check endpoint - provides server status metrics
    app.get('/health', (req, res) => {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      res.json({
        status: redisConnected ? 'OK' : 'Degraded (Redis unavailable)',
        uptime: `${Math.floor(uptime / 60)} minutes`,
        memoryUsage: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        },
        redis: getRedisClient() ? 'Connected' : 'Disconnected',
        queue: jobQueue ? 'Initialized' : 'Not Available',
        timestamp: new Date().toISOString(),
      });
    });

    // Serve static files for the dashboard UI
    app.use(express.static('src/dashboard/public'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.success(`Server running on port ${PORT}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`Dashboard available at http://localhost:${PORT}/dashboard`);
      logger.info(`Health check at http://localhost:${PORT}/health`);
      logger.info(`API base URL: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    logger.fail('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown handlers for termination signals
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, _promise) => {
  // Handle unhandled promise rejections
  logger.error('Unhandled Promise Rejection', {
    error: reason?.message || reason,
    location: 'unhandledRejection'
  });
});

process.on('uncaughtException', (error) => {
  // Handle uncaught exceptions
  logger.error('Uncaught Exception', {
    error: error.message,
    location: 'uncaughtException'
  });
  process.exit(1);
});

// Export app for testing
export { app };

startServer();