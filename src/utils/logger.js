import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

// ES module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === CONFIG FALLBACK ===
const ENV = config?.environment || 'development';
const SERVICE_NAME = config?.serviceName || 'app';
const VERSION = config?.version || '1.0.0';

// === LOG DIRECTORY ===
const LOG_DIR = path.join(__dirname, '../');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// === FORMATS ===
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level}]: ${message}\n${stack}`
      : `${timestamp} [${level}]: ${message}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    return JSON.stringify({
      ...info,
      service: SERVICE_NAME,
      version: VERSION,
      environment: ENV,
    });
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (Object.keys(meta).length > 0) {
      output += `\n  Data: ${JSON.stringify(meta, null, 2)}`;
    }
    if (stack) {
      output += `\n  Stack: ${stack}`;
    }
    return output + '\n';
  })
);

// === LEVEL ===
const levelMap = {
  production: 'warn',
  staging: 'info',
  development: 'debug',
};
const LOG_LEVEL = levelMap[ENV] || 'debug';

// === TRANSPORTS ===
const transports = [
  new winston.transports.Console({
    format: ENV === 'production' ? prodFormat : devFormat,
    silent: ENV === 'test',
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    format: fileFormat,
    maxsize: 20 * 1024 * 1024,
    maxFiles: 10,
    tailable: true,
  }),
];

// === LOGGER ===
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports,
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      format: fileFormat,
    }),
  ],
  exitOnError: false,
});

// === STARTUP MESSAGE ===
logger.info('Logger initialized', {
  environment: ENV,
  logLevel: LOG_LEVEL,
  logDirectory: LOG_DIR,
  nodeVersion: process.version,
  platform: process.platform,
});

export { logger };
