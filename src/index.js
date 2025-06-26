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

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Apply security and middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

async function startServer() {
  try {
    // Step 1: Connect to Redis
    logger.info('🚀 Starting Redis connection...');
    let redisConnected = false;
    let jobQueue = null;
    try {
      await connectRedis();
      redisConnected = true;
      logger.info('✅ Redis connected successfully');
    } catch (redisError) {
      logger.warn('⚠️ Redis connection failed, running in degraded mode', {
        error: redisError.message,
        code: redisError.code || 'UNKNOWN',
        stack: redisError.stack,
        endpoint: redisError.endpoint || 'unknown',
        opensslVersion: process.versions.openssl,
      });
    }

    // Step 2: Connect to MongoDB
    logger.info('🚀 Connecting to MongoDB...');
    await connectDB();
    logger.info('✅ MongoDB connected successfully');

    // Step 3: Initialize rate limiter
    logger.info('🚀 Initializing rate limiter...');
    const rateLimiter = createRateLimiter({ points: 100, duration: 3600 });
    app.use('/api/login', rateLimiter);
    app.use('/api/jobs', rateLimiter);
    logger.info('✅ Rate limiter initialized');

    // Step 4: Initialize job queue and worker
    if (redisConnected) {
      logger.info('🚀 Initializing job queue and worker...');
      try {
        jobQueue = createJobQueue();
        createEmailWorker();
        logger.info('✅ Job queue and worker initialized');
      } catch (queueError) {
        logger.warn('⚠️ Failed to initialize job queue, Bull Board disabled', {
          error: queueError.message,
          stack: queueError.stack,
        });
      }
    } else {
      logger.warn('⚠️ Job queue and worker skipped due to Redis failure');
    }

    // Step 5: Setup Bull Board dashboard (if Redis is connected)
    if (redisConnected && jobQueue) {
      logger.info('🚀 Setting up Bull Board dashboard...');
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath('/dashboard');
      createBullBoard({
        queues: [new BullMQAdapter(jobQueue)],
        serverAdapter,
      });
      app.use('/dashboard', authMiddleware, serverAdapter.getRouter());
      logger.info('✅ Bull Board dashboard enabled at /dashboard');
    } else {
      logger.warn('⚠️ Bull Board dashboard disabled due to Redis connection failure');
    }

    // Step 6: Setup routes and error handler
    logger.info('🚀 Setting up API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    logger.info('✅ API routes configured');

    // Step 7: Health check endpoint
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
      });
    });

    // Step 8: Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      opensslVersion: process.versions.openssl,
    });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Promise Rejection', {
    reason: reason.message || String(reason),
    stack: reason.stack || 'No stack trace',
    promise,
    opensslVersion: process.versions.openssl,
  });
});

// Start the server
startServer();