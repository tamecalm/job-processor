import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

export const connectDB = async (retryCount = 0, maxRetries = 5) => {
  try {
    logger.info('🚀 Attempting MongoDB connection', {
      uri: config.mongoUri.replace(/:[^@]+@/, ':***@'),
      retryCount,
    });

    await mongoose.connect(config.mongoUri, {
      connectTimeoutMS: 15000, // Increased timeout
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
      ssl: true, // Explicit SSL for Atlas
      serverApi: { version: '1', strict: true, deprecationErrors: true },
    });

    logger.info('✅ MongoDB connected successfully', {
      uri: config.mongoUri.replace(/:[^@]+@/, ':***@'),
      connectionName: mongoose.connection.name,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ MongoDB connection error', {
        error: err.message,
        code: err.code || 'UNKNOWN',
        stack: err.stack,
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('❌ MongoDB connection failed', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      retryCount,
      uri: config.mongoUri.replace(/:[^@]+@/, ':***@'),
    });

    if (retryCount < maxRetries) {
      logger.info(`🔄 Retrying MongoDB connection (${retryCount + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return connectDB(retryCount + 1, maxRetries);
    }

    throw new Error('MongoDB connection timed out');
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('🔌 MongoDB disconnected successfully');
  } catch (error) {
    logger.error('❌ MongoDB disconnection failed', {
      error: error.message,
      stack: error.stack,
    });
  }
};

process.on('SIGINT', async () => {
  await disconnectDB();
  logger.info('🔌 Application shutdown: SIGINT');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  logger.info('🔌 Application shutdown: SIGTERM');
  process.exit(0);
});