import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/job_processor',
  redisUri: process.env.REDIS_URI || 'redis://default:5l8ig5L8ReKWtomt5geQeOSz4ShoKCKy@redis-16422.c240.us-east-1-3.ec2.redns.redis-cloud.com:16422',
  redisUsername: process.env.REDIS_USERNAME || 'default',
  redisPassword: process.env.REDIS_PASSWORD || '5l8ig5L8ReKWtomt5geQeOSz4ShoKCKy',
  redisHost: process.env.REDIS_HOST || 'redis-16422.c240.us-east-1-3.ec2.redns.redis-cloud.com',
  redisPort: process.env.REDIS_PORT || 16422,
  jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
  environment: process.env.NODE_ENV || 'production',
};