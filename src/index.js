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
    console.log('🚀 Step 1: Starting Redis connection...');
    let redisConnected = false;
    let jobQueue = null;
    try {
      await withTimeout(connectRedis(), 5000, 'Redis connection');
      redisConnected = true;
      console.log('✅ Redis connected successfully');
    } catch (redisError) {
      console.warn('⚠️ Redis connection failed:', redisError.message);
    }

    console.log('🚀 Step 2: Connecting to MongoDB...');
    try {
      await withTimeout(connectDB(), 5000, 'MongoDB connection');
      console.log('✅ MongoDB connected successfully');
    } catch (mongoError) {
      console.error('❌ MongoDB connection failed:', mongoError.message);
      throw mongoError;
    }

    console.log('🚀 Step 3: Initializing rate limiter...');
    const rateLimiter = createRateLimiter({ points: 100, duration: 3600 });
    // app.use('/api/login', rateLimiter);
    // app.use('/api/jobs', rateLimiter);
    console.log('✅ Rate limiter initialized');

    if (redisConnected) {
      console.log('🚀 Step 4: Initializing job queue and worker...');
      try {
        jobQueue = createJobQueue();
        createEmailWorker();
        console.log('✅ Job queue and worker initialized');
      } catch (queueError) {
        console.warn('⚠️ Failed to initialize job queue:', queueError.message);
      }
    } else {
      console.warn('⚠️ Skipping job queue due to Redis failure');
    }

    if (redisConnected && jobQueue) {
      console.log('🚀 Step 5: Setting up Bull Board dashboard...');
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath('/dashboard');
      createBullBoard({
        queues: [new BullMQAdapter(jobQueue)],
        serverAdapter,
      });
      app.use('/dashboard', authMiddleware, serverAdapter.getRouter());
      console.log('✅ Bull Board dashboard enabled at /dashboard');
    } else {
      console.warn('⚠️ Bull Board disabled due to Redis issue');
    }

    console.log('🚀 Step 6: Registering API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    console.log('✅ API routes configured');

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
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

startServer();
