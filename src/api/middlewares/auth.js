import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : req.query.token;

  // Check for JWT token (header or query)
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
      logger.info('🚀 JWT authentication successful', { user: decoded.user });
      return next();
    } catch (error) {
      logger.error('❌ Invalid JWT token', { error: error.message });
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Check for Basic Auth
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.replace('Basic ', '');
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === 'admin' && (password === 'admin' || password === process.env.ADMIN_PASSWORD)) {
      req.user = { user: username };
      logger.info('🚀 Basic Auth successful', { user: username });
      return next();
    } else {
      logger.error('❌ Invalid Basic Auth credentials');
      res.status(401).set('WWW-Authenticate', 'Basic realm="Bull Dashboard"').json({ error: 'Invalid credentials' });
    }
  }

  logger.warn('⚠️ No valid authentication provided');
  res.status(401).set('WWW-Authenticate', 'Basic realm="Bull Dashboard"').json({ error: 'Access denied. No token or credentials provided.' });
};