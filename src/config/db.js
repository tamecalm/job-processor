import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

export const connectDB = async (retryCount = 0, maxRetries = 5) => {
  try {
    // Only log retry attempts, not the initial connection (handled in index.js)
    if (retryCount > 0) {
      logger.info(`Retrying MongoDB connection (${retryCount}/${maxRetries})`);
    }

    await mongoose.connect(config.mongoUri, {
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      retryWrites: true,
      w: 'majority',
      ssl: true,
      serverApi: { version: '1', strict: true, deprecationErrors: true },
    });

    // Set up event handlers after successful connection
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', {
        error: err.message,
        code: err.code || 'UNKNOWN',
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.debug('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection attempt failed', {
      error: error.message,
      code: error.code || 'UNKNOWN',
      retryCount,
    });

    if (retryCount < maxRetries) {
      logger.info(`Retrying MongoDB connection in 5 seconds (${retryCount + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return connectDB(retryCount + 1, maxRetries);
    }

    throw new Error('MongoDB connection failed after maximum retries');
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('MongoDB disconnection failed', {
      error: error.message,
    });
  }
};

// Graceful shutdown handlers (only if not handled elsewhere)
if (!process.listenerCount('SIGINT')) {
  process.on('SIGINT', async () => {
    await disconnectDB();
    logger.info('Application shutdown: SIGINT');
    process.exit(0);
  });
}

if (!process.listenerCount('SIGTERM')) {
  process.on('SIGTERM', async () => {
    await disconnectDB();
    logger.info('Application shutdown: SIGTERM');
    process.exit(0);
  });
}