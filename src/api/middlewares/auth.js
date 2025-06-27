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
      logger.debug('JWT authentication successful', { 
        userId: decoded.user?.id || decoded.id || 'unknown',
        method: 'JWT'
      });
      return next();
    } catch (error) {
      logger.warn('JWT authentication failed', { 
        error: error.message,
        tokenSource: authHeader ? 'header' : 'query'
      });
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
      logger.debug('Basic authentication successful', { 
        user: username,
        method: 'Basic'
      });
      return next();
    } else {
      logger.warn('Basic authentication failed', { 
        username: username || 'missing',
        reason: 'invalid_credentials'
      });
      return res.status(401)
        .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
        .json({ error: 'Invalid credentials' });
    }
  }

  logger.debug('Authentication required - no credentials provided', {
    userAgent: req.get('User-Agent')?.substring(0, 50) || 'unknown',
    ip: req.ip || req.connection.remoteAddress || 'unknown'
  });
  
  return res.status(401)
    .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
    .json({ error: 'Access denied. No token or credentials provided.' });
};