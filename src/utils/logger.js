import winston from 'winston';
import { config } from '../config/index.js';

const logger = winston.createLogger({
  level: config.environment === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' })
  ],
});

export { logger };