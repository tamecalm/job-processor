// import winston from 'winston';
// import { config } from '../config/index.js';

// const logger = winston.createLogger({
//   level: config.environment === 'production' ? 'info' : 'debug',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.json()
//   ),
//   transports: [
//     new winston.transports.Console(),
//     new winston.transports.File({ filename: 'combined.log' })
//   ],
// });

// export { logger };


import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Logger Configuration Module
 * 
 * This module provides a comprehensive logging solution using Winston logger.
 * It supports multiple log levels, different output formats, file rotation,
 * and environment-specific configurations.
 * 
 * Features:
 * - Console and file logging
 * - Log rotation to prevent large files
 * - Environment-specific log levels
 * - Structured JSON logging
 * - Error-specific logging
 * - Custom formatting for different environments
 * - Automatic log directory creation
 */

// Define log directory path
// If logger.js is in src/utils/ and you want combined.log in src/
const LOG_DIR = path.join(__dirname, '../');

/**
 * Ensure log directory exists
 * Creates the logs directory if it doesn't exist
 */
const ensureLogDirectory = () => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to create log directory:', error.message);
  }
};

// Create log directory
ensureLogDirectory();

/**
 * Custom format for console output in development
 * Provides colorized, human-readable log format
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Include stack traces for errors
  winston.format.colorize(), // Add colors to log levels
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // Format the log message
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add additional metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

/**
 * Custom format for production logging
 * Provides structured JSON format suitable for log aggregation
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Add application metadata
    return JSON.stringify({
      ...info,
      service: config.serviceName || 'app',
      version: config.version || '1.0.0',
      environment: config.environment
    });
  })
);

/**
 * Determine log level based on environment
 * - production: 'warn' (only warnings and errors)
 * - staging: 'info' (info, warnings, and errors)
 * - development: 'debug' (all log levels)
 */
const getLogLevel = () => {
  switch (config.environment) {
    case 'production':
      return 'warn';
    case 'staging':
      return 'info';
    case 'development':
    default:
      return 'debug';
  }
};

/**
 * Configure console transport
 * Different formatting based on environment
 */
const consoleTransport = new winston.transports.Console({
  format: config.environment === 'production' ? productionFormat : developmentFormat,
  silent: config.environment === 'test' // Disable console logs in test environment
});

/**
 * Human-readable format for file logging
 * Provides clean, readable format for log files while maintaining structure
 */
const humanReadableFileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, service, version, environment, ...meta }) => {
    // Start with basic log line
    let logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    // Add service info if available
    if (service || version || environment) {
      const serviceInfo = [service, version, environment].filter(Boolean).join(' | ');
      logLine += ` | ${serviceInfo}`;
    }
    
    // Add metadata if present (excluding common fields)
    const cleanMeta = { ...meta };
    delete cleanMeta.timestamp;
    delete cleanMeta.level;
    delete cleanMeta.message;
    
    if (Object.keys(cleanMeta).length > 0) {
      logLine += `\n  Data: ${JSON.stringify(cleanMeta, null, 2)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      logLine += `\n  Stack: ${stack}`;
    }
    
    return logLine + '\n';
  })
);

/**
 * Configure file transport - single combined.log file
 * All log levels in human-readable format with automatic rotation
 */
const fileTransports = [
  // Single combined log file - all log levels in human-readable format
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    format: humanReadableFileFormat,
    maxsize: 20 * 1024 * 1024, // 20MB max file size (larger since it's the only file)
    maxFiles: 10, // Keep 10 backup files
    tailable: true // Keep writing to the same file
  })
];

/**
 * Main logger configuration
 * Creates Winston logger instance with comprehensive settings
 */
const logger = winston.createLogger({
  // Set log level based on environment
  level: getLogLevel(),
  
  // Default format for all logs
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  
  // Configure transports
  transports: [
    consoleTransport,
    ...fileTransports
  ],
  
  // Exit on handled exceptions
  exitOnError: false,
  
  // Handle uncaught exceptions - log to combined.log
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: humanReadableFileFormat
    })
  ],
  
  // Handle unhandled promise rejections - log to combined.log
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: humanReadableFileFormat
    })
  ]
});

/**
 * Create child logger with persistent context
 * Useful for adding consistent metadata to all logs in a specific context
 * @param {Object} context - Context object to be added to all logs
 * @returns {Object} Child logger instance
 */
logger.child = (context) => {
  return logger.child(context);
};

// Add environment info on startup
logger.info('Logger initialized', {
  environment: config.environment,
  logLevel: getLogLevel(),
  logDirectory: LOG_DIR,
  nodeVersion: process.version,
  platform: process.platform
});

export { logger };