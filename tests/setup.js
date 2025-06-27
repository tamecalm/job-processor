import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(async () => {
  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(async () => {
  // Restore console methods
  if (!process.env.DEBUG) {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }

  // Close database connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

// Global test helpers
global.testHelpers = {
  // Helper to create test job data
  createTestJobData: (overrides = {}) => ({
    name: 'sendEmail',
    data: {
      recipient: 'test@example.com',
      subject: 'Test Email',
      ...overrides.data
    },
    ...overrides
  }),

  // Helper to wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate random test data
  randomString: (length = 10) => Math.random().toString(36).substring(2, length + 2),
  
  // Helper to generate test email
  randomEmail: () => `test-${Math.random().toString(36).substring(2, 8)}@example.com`
};

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  if (process.env.DEBUG) {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  }
});