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
    logger.info('🚀 Step 1: Starting Redis connection...');
    let redisConnected = false;
    let jobQueue = null;
    
    try {
      await withTimeout(connectRedis(), 15000, 'Redis connection');
      redisConnected = true;
      logger.info('✅ Redis connected successfully');
    } catch (redisError) {
      logger.error('❌ Redis connection failed:', { error: redisError.message });
    }

    logger.info('🚀 Step 2: Connecting to MongoDB...');
    try {
      await withTimeout(connectDB(), 10000, 'MongoDB connection');
      logger.info('✅ MongoDB connected successfully');
    } catch (mongoError) {
      logger.error('❌ MongoDB connection failed:', { error: mongoError.message });
      throw mongoError;
    }

    logger.info('🚀 Step 3: Initializing rate limiter...');
    const rateLimiter = createRateLimiter({ points: 100, duration: 3600 });
    // app.use('/api', rateLimiter);
    logger.info('✅ Rate limiter initialized');

    if (redisConnected) {
      logger.info('🚀 Step 4: Initializing job queue and worker...');
      try {
        // Initialize job queue
        jobQueue = createJobQueue();
        if (jobQueue) {
          logger.info('✅ Job queue initialized');
          
          // Initialize worker
          const worker = createEmailWorker();
          if (worker) {
            logger.info('✅ Email worker initialized');
          } else {
            logger.warn('⚠️ Email worker initialization failed');
          }
        } else {
          logger.warn('⚠️ Job queue initialization failed, skipping worker');
          redisConnected = false;
        }
      } catch (queueError) {
        logger.error('❌ Failed to initialize job queue or worker:', { 
          error: queueError.message,
          stack: queueError.stack 
        });
        redisConnected = false;
      }
    } else {
      logger.warn('⚠️ Skipping job queue due to Redis failure');
    }

    if (redisConnected && jobQueue) {
      logger.info('🚀 Step 5: Setting up Bull Board dashboard...');
      try {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/dashboard');
        createBullBoard({
          queues: [new BullMQAdapter(jobQueue)],
          serverAdapter,
        });
        app.use('/dashboard', authMiddleware, serverAdapter.getRouter());
        logger.info('✅ Bull Board dashboard enabled at /dashboard');
      } catch (bullBoardError) {
        logger.error('❌ Failed to set up Bull Board:', { 
          error: bullBoardError.message,
          stack: bullBoardError.stack 
        });
      }
    } else {
      logger.warn('⚠️ Bull Board disabled due to Redis or queue issue');
    }

    logger.info('🚀 Step 6: Registering API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    logger.info('✅ API routes configured');

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
      });
    });

    // Serve static files for dashboard
    app.use(express.static('src/dashboard/public'));

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
      logger.info(`🔍 Health Check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🔄 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🔄 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Promise Rejection:', { 
    reason: reason?.message || reason,
    stack: reason?.stack 
  });
});

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});

startServer();