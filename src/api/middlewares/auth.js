import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      logger.info('🚀 JWT authentication successful', { user: decoded.user || decoded });
      return next();
    } catch (error) {
      logger.error('❌ Invalid JWT token', { error: error.message });
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  if (authHeader?.startsWith('Basic ')) {
    const base64Credentials = authHeader.replace('Basic ', '');
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (password === process.env.ADMIN_PASSWORD) {
      req.user = { user: username || 'admin' };
      logger.info('🚀 Basic Auth successful', { user: req.user.user });
      return next();
    } else {
      logger.error('❌ Invalid Basic Auth credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  logger.warn('⚠️ No valid authentication provided');
  return res.status(401).json({ error: 'Access denied. No token or credentials provided.' });
};
