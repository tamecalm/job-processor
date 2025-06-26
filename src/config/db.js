import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

export async function connectDatabase() {
  try {
    const dbName = 'J';
    const dbUri = `${config.mongoUri?.replace(/\/\w+$/, '') || 'Not In List'}/${dbName}`; // Fallback to 'not set'

    const mongooseOptions = {
      dbName,
      autoIndex: true,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
    };

    await mongoose.connect(dbUri, mongooseOptions);

    logger.info(
      `✅ Successfully connected to MongoDB - Database: ${dbName}, URI: ${config.mongoUri ? 'Present' : 'Not In List'}`,
    );
  } catch (error) {
    logger.error(`❌ Failed to connect to MongoDB: ${error.message}`);
    logger.warn(`🔄 Attempting to reconnect to MongoDB in 5 seconds...`);
    setTimeout(connectDatabase, 5000); // Retry after 5 seconds
  }
}

// Event listeners for connection monitoring
mongoose.connection.on('connected', () => {
  logger.info(`✅ MongoDB connection established`);
});

mongoose.connection.on('error', (err) => {
  logger.error(`⚠️ MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  logger.warn(`🔌 MongoDB connection lost. Native reconnection will attempt to restore.`);
});

mongoose.connection.on('reconnect', () => {
  logger.info(`🔄 MongoDB successfully reconnected`);
});

mongoose.connection.on('close', () => {
  logger.error(`❌ MongoDB connection closed unexpectedly. Check server status.`);
  logger.warn(`🔄 Scheduling manual reconnect attempt in 5 seconds...`);
  setTimeout(connectDatabase, 5000);
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  logger.error(`⚠️ Uncaught Exception: ${error.message}`, { stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`⚠️ Unhandled Rejection at: ${promise}, reason: ${reason.message || reason}`);
});

export default connectDatabase;