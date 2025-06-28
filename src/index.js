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

// Security: Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Security: CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' })); // Security: Limit request size

// Security: Add request ID for tracking
app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-ID', req.id);
  next();
});

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
    // Security: Validate critical environment variables
    const requiredEnvVars = ['JWT_SECRET', 'ADMIN_PASSWORD', 'MONGO_URI', 'REDIS_URI'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error('SECURITY: Missing required environment variables', { 
        missing: missingVars 
      });
      process.exit(1);
    }

    // Security: Validate JWT secret strength
    if (process.env.JWT_SECRET.length < 15) {
      logger.error('SECURITY: JWT_SECRET must be at least 15 characters long');
      process.exit(1);
    }

    // Security: Validate admin password strength
    if (process.env.ADMIN_PASSWORD.length < 4) {
      logger.error('SECURITY: ADMIN_PASSWORD must be at least 4 characters long');
      process.exit(1);
    }

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
    const rateLimiter = createRateLimiter({ points: 60, duration: 60 });
    // Security: Enable rate limiting for job processing endpoints
    // Uncomment the following line to enable rate limiting in production
    // app.use('/api/jobs', rateLimiter);
    logger.success('Rate limiter initialized');

    if (redisConnected) {
      logger.start('Initializing job queue and worker...');
      try {
        jobQueue = createJobQueue();
        if (jobQueue) {
          logger.success('Job queue initialized');
          
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

    logger.start('Setting up Swagger API documentation...');
    setupSwagger(app, '/api-docs');

    logger.start('Registering API routes...');
    app.use('/api', jobRoutes);
    app.use(errorHandler);
    logger.success('API routes configured');

    // Health check endpoint with security considerations
    app.get('/health', (req, res) => {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Security: Limited information disclosure
      const healthData = {
        status: redisConnected ? 'OK' : 'Degraded (Redis unavailable)',
        uptime: `${Math.floor(uptime / 60)} minutes`,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      };

      // Security: Only include detailed info in development
      if (process.env.NODE_ENV === 'development') {
        healthData.memoryUsage = {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        };
        healthData.redis = getRedisClient() ? 'Connected' : 'Disconnected';
        healthData.queue = jobQueue ? 'Initialized' : 'Not Available';
      }

      res.json(healthData);
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

// Security: Enhanced graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Close Redis connections
    const { disconnectRedis } = await import('./config/redis.js');
    await disconnectRedis();
    
    // Close MongoDB connections
    const { disconnectDB } = await import('./config/db.js');
    await disconnectDB();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    error: reason?.message || reason,
    location: 'unhandledRejection',
    // Security: Don't log full stack traces in production
    ...(process.env.NODE_ENV === 'development' && { stack: reason?.stack })
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    location: 'uncaughtException',
    // Security: Don't log full stack traces in production
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
  process.exit(1);
});

export { app };

startServer();