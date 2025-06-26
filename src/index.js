import express from 'express';
import mongoose from 'mongoose';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import dotenv from 'dotenv';
import winston from 'winston';
import cors from 'cors';
import helmet from 'helmet';
import jobRoutes from './api/routes/jobRoutes.js';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import { jobQueue } from './jobs/queue.js';
import { authMiddleware } from './api/middlewares/auth.js';
import { errorHandler } from './api/middlewares/errorHandler.js';
import { rateLimiter } from './api/middlewares/rateLimiter.js';
import { logger } from './utils/logger.js';

dotenv.config();
const app = express();

// Security middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
app.use('/api/login', rateLimiter);
app.use('/api/jobs', rateLimiter);

// Connect to MongoDB and Redis
connectDB();
connectRedis();

// Bull Board Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/dashboard');
const { addQueue, setQueues, replaceQueues, createBullBoardHandler } = createBullBoard({
  queues: [new BullMQAdapter(jobQueue)],
  serverAdapter,
});
app.use('/dashboard', authMiddleware, serverAdapter.getRouter());

// Health check endpoint
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  res.json({
    status: 'OK',
    uptime: `${Math.floor(uptime / 60)} minutes`,
    memoryUsage: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    },
  });
});

// API routes
app.use('/api', jobRoutes);

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});