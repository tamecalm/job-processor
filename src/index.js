import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import jobRoutes from './api/routes/jobRoutes.js';
import { connectRedis, getRedisClient } from './config/redis.js';
import { connectDB } from './config/db.js';
import { createJobQueue } from './jobs/queue.js';
import { createEmailWorker } from './jobs/workers/emailWorker.js';
import { authMiddleware } from './api/middlewares/auth.js';
import { errorHandler } from './api/middlewares/errorHandler.js';
import { createRateLimiter } from './api/middlewares/rateLimiter.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Timeout wrappers for debugging long hangs
const withTimeout = (promise, timeout, label) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), timeout)
    ),
  ]);
};

async function startServer() {
  try {
    logger.start('Starting Redis connection...');
    let redisConnected = false;
    let jobQueue = null;
    
    try {
      await withTimeout(connectRedis(), 15000, 'Redis connection');
      redisConnected = true;
      logger.success('Redis connected successfully');
    } catch (redisError) {
      logger.fail('Redis connection failed', { error: redisError.message });
    }

    logger.start('Connecting to MongoDB...');
    try {
      await withTimeout(connectDB(), 10000, 'MongoDB connection');
      logger.success('MongoDB connected successfully');
    } catch (mongoError) {
      logger.fail('MongoDB connection failed', { error: mongoError.message });
      throw mongoError;
    }

    logger.start('Initializing rate limiter...');
     // If you're testing locally, consider temporarily disabling rate limiting in development environments.
    // eslint-disable-next-line no-unused-vars
    const rateLimiter = createRateLimiter({ points: 60, duration: 60 });
    // app.use('/api/jobs', rateLimiter);
    logger.success('Rate limiter initialized');

    if (redisConnected) {
      logger.start('Initializing job queue and worker...');
      try {
        // Initialize job queue
        jobQueue = createJobQueue();
        if (jobQueue) {
          logger.success('Job queue initialized');
          
          // Initialize worker
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

    logger.start('Registering API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    logger.success('API routes configured');

    // Health check endpoint
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

    // Serve static files for dashboard
    app.use(express.static('src/dashboard/public'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.success(`Server running on port ${PORT}`);
      logger.info(`Dashboard available at http://localhost:${PORT}/dashboard`);
      logger.info(`Health check at http://localhost:${PORT}/health`);
      logger.info(`API base URL: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    logger.fail('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Promise Rejection', { 
    error: reason?.message || reason,
    location: 'unhandledRejection'
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    location: 'uncaughtException'
  });
  process.exit(1);
});

// Export app for testing
export { app };

startServer();