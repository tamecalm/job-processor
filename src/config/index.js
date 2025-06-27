import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI,
  redisUri: process.env.REDIS_URI,
  jwtSecret: process.env.JWT_SECRET,
  environment: process.env.NODE_ENV
};