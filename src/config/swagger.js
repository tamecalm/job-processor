import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from '../utils/logger.js';

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let swaggerDocument = null;

/**
 * Load Swagger JSON document
 * @returns {Object|null} Swagger document or null if loading fails
 */
export const loadSwaggerDocument = () => {
  if (swaggerDocument) {
    return swaggerDocument;
  }

  try {
    // Resolve path to swagger.json file
    const swaggerPath = join(__dirname, '../../swagger/swagger.json');
    const swaggerContent = readFileSync(swaggerPath, 'utf8');
    swaggerDocument = JSON.parse(swaggerContent);
    
    logger.info('Swagger document loaded successfully', {
      title: swaggerDocument.info?.title,
      version: swaggerDocument.info?.version,
      pathCount: Object.keys(swaggerDocument.paths || {}).length
    });
    
    return swaggerDocument;
  } catch (error) {
    logger.error('Failed to load Swagger document', {
      error: error.message,
      stack: error.stack
    });
    return null;
  }
};

/**
 * Setup Swagger UI middleware
 * @param {Object} app - Express app instance
 * @param {string} [route='/api-docs'] - Route to serve Swagger UI
 */
export const setupSwagger = (app, route = '/api-docs') => {
  try {
    const swaggerDoc = loadSwaggerDocument();
    
    if (!swaggerDoc) {
      logger.warn('Swagger UI setup skipped - document not available');
      return;
    }

    // Swagger UI options
    const swaggerOptions = {
      explorer: true,
      swaggerOptions: {
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        tryItOutEnabled: true,
        requestInterceptor: (req) => {
          // Add any request interceptors here if needed
          return req;
        }
      },
      customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .scheme-container { margin: 20px 0; }
      `,
      customSiteTitle: 'Job Processor API Documentation',
      customfavIcon: '/favicon.ico'
    };

    // Setup Swagger UI routes
    app.use(route, swaggerUi.serve);
    app.get(route, swaggerUi.setup(swaggerDoc, swaggerOptions));

    // Add JSON endpoint for raw swagger document
    app.get(`${route}.json`, (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDoc);
    });

    logger.success(`Swagger UI configured at ${route}`);
    logger.info(`Swagger JSON available at ${route}.json`);
    
  } catch (error) {
    logger.error('Failed to setup Swagger UI', {
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Get Swagger document (for testing or other uses)
 * @returns {Object|null} Swagger document
 */
export const getSwaggerDocument = () => {
  return swaggerDocument || loadSwaggerDocument();
};