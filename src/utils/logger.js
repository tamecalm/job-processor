import winston from 'winston';
import path from 'path';
// import { fileURLToPath } from 'url';

// ESM __dirname alternative (commented out for reference)
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Use process.cwd() as an alternative base path
const logFilePath = path.join(process.cwd(), '/logs/combined.log');

// Custom format for clean, readable logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const levelColors = {
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      debug: '\x1b[35m',   // Magenta
      reset: '\x1b[0m'     // Reset
    };

    const color = levelColors[level] || levelColors.reset;
    const reset = levelColors.reset;

    let logMessage = `${color}[${timestamp}] ${level.toUpperCase()}${reset}: ${message}`;

    if (Object.keys(meta).length > 0) {
      logMessage += `\n  ${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  })
);

// File format (no colors for file logs)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (Object.keys(meta).length > 0) {
      logMessage += ` | ${JSON.stringify(meta)}`;
    }
    return logMessage;
  })
);

// Create logger
const logger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.Console({ format: customFormat }),
    new winston.transports.File({
      filename: logFilePath,
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    })
  ]
});

// Add custom methods for better usability
logger.success = (message, meta) => logger.info(`✅ ${message}`, meta);
logger.fail = (message, meta) => logger.error(`❌ ${message}`, meta);
logger.start = (message, meta) => logger.info(`🚀 ${message}`, meta);
logger.complete = (message, meta) => logger.info(`✨ ${message}`, meta);

export { logger };
