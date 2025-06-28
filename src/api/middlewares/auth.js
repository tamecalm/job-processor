import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Authentication middleware handling JWT and Basic Auth
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : req.query.token;

  // JWT Authentication Flow
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        issuer: 'job-processor-api',
        audience: 'job-processor-client'
      });
      
      // Additional security checks
      if (decoded.ip && decoded.ip !== req.ip) {
        logger.warn('JWT token IP mismatch detected', {
          tokenIp: decoded.ip,
          requestIp: req.ip,
          user: decoded.user
        });
        return res.status(401).json({ error: 'Token validation failed' });
      }
      
      req.user = decoded;
      logger.debug('JWT authentication successful', { 
        userId: decoded.user || 'unknown',
        method: 'JWT'
      });
      return next();
    } catch (error) {
      logger.warn('JWT authentication failed', { 
        error: error.message,
        tokenSource: authHeader ? 'header' : 'query',
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // Basic Authentication Flow - SECURE VERSION
  if (authHeader && authHeader.startsWith('Basic ')) {
    const base64Credentials = authHeader.replace('Basic ', '');
    
    try {
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [username, password] = credentials.split(':');

      // Input validation
      if (!username || !password) {
        logger.warn('Basic auth with missing credentials', { ip: req.ip });
        return res.status(401)
          .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
          .json({ error: 'Invalid credentials format' });
      }

      // SECURE: Only use environment variables, no hardcoded fallbacks
      if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
        // Verify admin password is properly configured
        if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 4) {
          logger.error('SECURITY: Admin password not configured or too weak');
          return res.status(500).json({ error: 'Server configuration error' });
        }

        req.user = { user: username };
        logger.debug('Basic authentication successful', { 
          user: username,
          method: 'Basic',
          ip: req.ip
        });
        return next();
      } else {
        logger.warn('Basic authentication failed', { 
          username: username?.substring(0, 20), // Limit logged data
          ip: req.ip,
          reason: 'invalid_credentials'
        });
        
        // Consistent timing to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return res.status(401)
          .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
          .json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      logger.warn('Basic auth parsing error', {
        error: error.message,
        ip: req.ip
      });
      return res.status(401)
        .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
        .json({ error: 'Invalid credentials format' });
    }
  }

  // No credentials provided
  logger.debug('Authentication required - no credentials provided', {
    userAgent: req.get('User-Agent')?.substring(0, 50) || 'unknown',
    ip: req.ip
  });
  
  return res.status(401)
    .set('WWW-Authenticate', 'Basic realm="Bull Dashboard"')
    .json({ error: 'Authentication required' });
};