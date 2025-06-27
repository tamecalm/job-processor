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
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let output = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (Object.keys(meta).length > 0) {
      output += ` | Data: ${JSON.stringify(meta, null, 2)}`;
    }
    return output;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  logFormat
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
    format: consoleFormat,
    silent: ENV === 'test',
  }),
  new winston.transports.File({
    filename: path.join(LOG_DIR, 'combined.log'),
    format: logFormat,
    maxsize: 20 * 1024 * 1024, // 20MB
    maxFiles: 10,
    tailable: true,
  }),
];

// === LOGGER ===
const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false,
});

// === STARTUP MESSAGE ===
logger.info('Logger initialized', {
  environment: ENV,
  logLevel: LOG_LEVEL,
  logDirectory: LOG_DIR,
});

export { logger };