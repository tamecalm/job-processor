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
    logger.warn('🚀 Step 1: Starting Redis connection...');
    let redisConnected = false;
    let jobQueue = null;
    try {
      await withTimeout(connectRedis(), 15000, 'Redis connection');
      redisConnected = true;
      logger.warn('✅ Redis connected successfully');
    } catch (redisError) {
      logger.warn('⚠️ Redis connection failed:', { error: redisError.message });
    }

    logger.warn('🚀 Step 2: Connecting to MongoDB...');
    try {
      await withTimeout(connectDB(), 10000, 'MongoDB connection');
      logger.warn('✅ MongoDB connected successfully');
    } catch (mongoError) {
      logger.warn('⚠️ MongoDB connection failed:', { error: mongoError.message });
      throw mongoError;
    }

    logger.warn('🚀 Step 3: Initializing rate limiter...');
    const rateLimiter = createRateLimiter({ points: 100, duration: 3600 });
    // app.use('/api', rateLimiter);
    logger.warn('✅ Rate limiter initialized');

    if (redisConnected) {
      logger.warn('🚀 Step 4: Initializing job queue and worker...');
      try {
        jobQueue = createJobQueue();
        if (jobQueue) {
          createEmailWorker();
          logger.warn('✅ Job queue and worker initialized');
        } else {
          logger.warn('⚠️ Job queue initialization failed, skipping worker');
          redisConnected = false;
        }
      } catch (queueError) {
        logger.warn('⚠️ Failed to initialize job queue or worker:', { error: queueError.message });
        redisConnected = false;
      }
    } else {
      logger.warn('⚠️ Skipping job queue due to Redis failure');
    }

    if (redisConnected && jobQueue) {
      logger.warn('🚀 Step 5: Setting up Bull Board dashboard...');
      try {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/dashboard');
        createBullBoard({
          queues: [new BullMQAdapter(jobQueue)],
          serverAdapter,
        });
        app.use('/dashboard', authMiddleware, serverAdapter.getRouter());
        logger.warn('✅ Bull Board dashboard enabled at /dashboard');
      } catch (bullBoardError) {
        logger.warn('⚠️ Failed to set up Bull Board:', { error: bullBoardError.message });
      }
    } else {
      logger.warn('⚠️ Bull Board disabled due to Redis or queue issue');
    }

    logger.warn('🚀 Step 6: Registering API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    logger.warn('✅ API routes configured');

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

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.warn(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.warn('⚠️ Failed to start server:', { error: error.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.warn('⚠️ Unhandled Promise Rejection:', { reason });
});

startServer();