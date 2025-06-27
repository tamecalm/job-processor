import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Authentication middleware handling JWT and Basic Auth
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 * @description
 * 1. Checks Authorization header (Bearer token or Basic Auth)
 * 2. Validates JWT token if present
 * 3. Validates Basic Auth credentials if present
 * 4. Attaches user object to req.user on success
 * @env_vars Uses process.env.ADMIN_PASSWORD for admin password
 */
export const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : req.query.token;

  /**
   * JWT Authentication Flow:
   * 1. Extracts token from Authorization header (Bearer) or query parameter
   * 2. Verifies token signature using config.jwtSecret
   * 3. Attaches decoded user to req.user
   * 4. Logs authentication success/failure details
   */
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

  /**
   * Basic Authentication Flow:
   * 1. Extracts credentials from Authorization header (Basic)
   * 2. Validates against admin credentials (either 'admin' or env var)
   * 3. Attaches user object to req.user on success
   * 4. Sends 401 with WWW-Authenticate header on failure
   */
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

  /**
   * Final fallback for missing credentials:
   * 1. Logs detailed debug information about the request
   * 2. Sends 401 response with WWW-Authenticate header
   * 3. Includes user agent and IP address in logs
   */
  logger.debug('Authentication required - no credentials provided', {
    userAgent: req.get('User-Agent')?.substring(0, 50) || 'unknown',
    ip: req.ip || req.connection.remoteAddress || 'unknown'
  });
  
  return res.status(401)
    .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
    .json({ error: 'Access denied. No token or credentials provided.' });
};