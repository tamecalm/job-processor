import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/job_processor',
  redisUri: process.env.REDIS_URI || 'rediss://default:AXUBAAIjcDEwNjE4MTYwYWRiZTE0YTc0OTU2M2FhODc5NjUyZWJjMHAxMA@charmed-parakeet-29953.upstash.io:6379',
  jwtSecret: process.env.JWT_SECRET || 'oPRDbdHULs7dtxs',
  environment: process.env.NODE_ENV || 'development',
};

// logger.warn('⚠️ Loaded configuration', {
//   port: config.port,
//   mongoUri: config.mongoUri.replace(/:[^@]+@/, ':***@'),
//   redisUri: config.redisUri.replace(/:[^@]+@/, ':***@'),
//   environment: config.environment,
// });