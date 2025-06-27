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
      await withTimeout(connectRedis(), 15000, 'Redis connection');
      redisConnected = true;
      console.log('✅ Redis connected successfully');
    } catch (redisError) {
      console.error('❌ Redis connection failed:', redisError.message);
    }

    console.log('🚀 Step 2: Connecting to MongoDB...');
    try {
      await withTimeout(connectDB(), 10000, 'MongoDB connection');
      console.log('✅ MongoDB connected successfully');
    } catch (mongoError) {
      console.error('❌ MongoDB connection failed:', mongoError.message);
      throw mongoError;
    }

    console.log('🚀 Step 3: Initializing rate limiter...');
    const rateLimiter = createRateLimiter({ points: 100, duration: 3600 });
    // app.use('/api', rateLimiter);
    console.log('✅ Rate limiter initialized');

    if (redisConnected) {
      console.log('🚀 Step 4: Initializing job queue and worker...');
      try {
        // Initialize job queue
        jobQueue = createJobQueue();
        if (jobQueue) {
          console.log('✅ Job queue initialized');
          
          // Initialize worker
          const worker = createEmailWorker();
          if (worker) {
            console.log('✅ Email worker initialized');
          } else {
            console.warn('⚠️ Email worker initialization failed');
          }
        } else {
          console.warn('⚠️ Job queue initialization failed, skipping worker');
          redisConnected = false;
        }
      } catch (queueError) {
        console.error('❌ Failed to initialize job queue or worker:', queueError.message);
        console.error('Stack:', queueError.stack);
        redisConnected = false;
      }
    } else {
      console.warn('⚠️ Skipping job queue due to Redis failure');
    }

    if (redisConnected && jobQueue) {
      console.log('🚀 Step 5: Setting up Bull Board dashboard...');
      try {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/dashboard');
        createBullBoard({
          queues: [new BullMQAdapter(jobQueue)],
          serverAdapter,
        });
        app.use('/dashboard', authMiddleware, serverAdapter.getRouter());
        console.log('✅ Bull Board dashboard enabled at /dashboard');
      } catch (bullBoardError) {
        console.error('❌ Failed to set up Bull Board:', bullBoardError.message);
        console.error('Stack:', bullBoardError.stack);
      }
    } else {
      console.warn('⚠️ Bull Board disabled due to Redis or queue issue');
    }

    console.log('🚀 Step 6: Registering API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    console.log('✅ API routes configured');

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
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/health`);
      console.log(`🚀 API Base URL: http://localhost:${PORT}/api`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason?.message || reason);
  if (reason?.stack) {
    console.error('Stack:', reason.stack);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Export app for testing
export { app };

startServer();