# 🚀 Job Processing System

A production-ready background job processing system built with Node.js, Express, BullMQ, Redis, and MongoDB. Features a real-time dashboard, secure APIs, comprehensive documentation, and robust job handling with retry mechanisms.

## 📋 Table of Contents

- [Features](#-features)
- [Security](#-security)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Dashboard](#-dashboard)
- [Development](#-development)
- [Production Deployment](#-production-deployment)
- [Monitoring & Logging](#-monitoring--logging)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Functionality
- **Background Job Processing**: Reliable job queue using BullMQ with Redis
- **Job Types**: Email processing with extensible architecture for additional job types
- **Retry Logic**: Automatic retry with exponential backoff (3 attempts)
- **Job Persistence**: MongoDB storage for job metadata and results
- **Real-time Dashboard**: Bull Board integration for job monitoring

### Security & Performance
- **JWT Authentication**: Secure API access with token-based auth and enhanced claims
- **Rate Limiting**: Redis-backed rate limiting to prevent abuse
- **Input Validation**: Joi schema validation with security patterns for all API inputs
- **CORS & Security Headers**: Helmet.js for security best practices with CSP
- **Structured Logging**: Winston logger with file and console output
- **Credential Security**: Secure credential handling with no hardcoded fallbacks

### API Documentation
- **Interactive Swagger UI**: Comprehensive API documentation at `/api-docs`
- **OpenAPI 3.0 Specification**: Complete API schema with examples
- **Try It Out**: Interactive API testing directly from documentation
- **JSON Export**: Raw swagger document available at `/api-docs.json`

### Monitoring & Operations
- **Health Checks**: System status endpoint with memory and uptime metrics
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Graceful Shutdown**: Clean process termination handling
- **Docker Support**: Full containerization with Docker Compose

## 🔒 Security

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication with IP validation
- **Basic Auth Fallback**: Secure basic authentication for dashboard access
- **No Hardcoded Credentials**: All credentials from environment variables only
- **Token Validation**: Enhanced JWT validation with issuer/audience claims

### Input Security
- **Schema Validation**: Joi validation with security patterns
- **XSS Prevention**: Input sanitization to prevent script injection
- **SQL Injection Protection**: MongoDB parameterized queries
- **Request Size Limits**: Configurable request payload limits

### Infrastructure Security
- **Security Headers**: Comprehensive HTTP security headers via Helmet.js
- **CORS Configuration**: Configurable cross-origin resource sharing
- **TLS/SSL Support**: Production-ready TLS configuration
- **Rate Limiting**: Distributed rate limiting with Redis backend

### Credential Management
- **Environment Variables**: All secrets via environment configuration
- **Credential Validation**: Runtime validation of credential strength
- **Secure Logging**: Sensitive data masking in logs
- **Timing Attack Prevention**: Consistent response times for auth failures

## 🏗 Architecture

### System Design Decisions

**Why BullMQ + Redis?**
- **Reliability**: Redis provides persistent job storage and atomic operations
- **Scalability**: Horizontal scaling with multiple workers
- **Performance**: In-memory operations with optional persistence
- **Features**: Built-in retry logic, job prioritization, and delayed jobs

**Why MongoDB for Job Metadata?**
- **Flexibility**: Schema-less design for varying job data structures
- **Querying**: Rich query capabilities for job analytics and reporting
- **Persistence**: Long-term storage of job history and results
- **Integration**: Seamless integration with Node.js ecosystem

**Security Architecture:**
- **Multi-layer Auth**: JWT for API access, Basic Auth fallback for dashboard
- **Rate Limiting**: Redis-backed distributed rate limiting
- **Input Sanitization**: Joi validation prevents malformed data injection
- **Environment Isolation**: Separate configs for dev/staging/production

### Project Structure
```
job-processor/
├── src/
│   ├── api/                    # API layer
│   │   ├── controllers/        # Request handlers
│   │   ├── middlewares/        # Auth, rate limiting, error handling
│   │   └── routes/            # Route definitions
│   ├── config/                # Configuration management
│   │   ├── db.js              # MongoDB connection
│   │   ├── redis.js           # Redis connection
│   │   ├── swagger.js         # Swagger UI configuration
│   │   └── index.js           # Environment config
│   ├── jobs/                  # Job processing layer
│   │   ├── processors/        # Job execution logic
│   │   ├── workers/           # BullMQ workers
│   │   └── queue.js           # Queue configuration
│   ├── models/                # MongoDB schemas
│   ├── services/              # Business logic layer
│   ├── utils/                 # Utilities (logger, validator)
│   ├── dashboard/             # Static dashboard files
│   └── index.js               # Application entry point
├── swagger/                   # API documentation
│   └── swagger.json           # OpenAPI specification
├── tests/                     # Test suites
├── docker-compose.yml         # Container orchestration
├── Dockerfile                 # Container definition
└── README.md                  # This file
```

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **Redis** >= 6.0 (or Redis cloud service like Upstash)
- **MongoDB** >= 4.4 (or MongoDB Atlas)
- **Docker** & **Docker Compose** (for containerized deployment)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <your-repo-url>
cd job-processor
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Connections
MONGO_URI=mongodb://localhost:27017/job_processor
# For MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/job_processor

# Redis Configuration
REDIS_URI=redis://localhost:6379
# For Upstash Redis:
# REDIS_URI=rediss://default:password@host:port

# Security (CRITICAL: CHANGE THESE!)
# Generate with: openssl rand -base64 64
JWT_SECRET=CHANGE-THIS-TO-A-CRYPTOGRAPHICALLY-SECURE-RANDOM-STRING-AT-LEAST-64-CHARACTERS-LONG

# Generate with: openssl rand -base64 32
ADMIN_PASSWORD=CHANGE-THIS-TO-A-STRONG-PASSWORD-AT-LEAST-12-CHARS

# Optional: Production CORS origins
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### 3. Start Services

**Option A: Local Development**
```bash
# Start MongoDB and Redis locally, then:
npm run dev
```

**Option B: Docker Compose (Recommended)**
```bash
docker-compose up -d
```

### 4. Verify Installation
- **API Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/api-docs
- **Dashboard**: http://localhost:3000/dashboard (login with admin credentials)
- **API Base**: http://localhost:3000/api

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required | Security Notes |
|----------|-------------|---------|----------|----------------|
| `PORT` | Server port | `3000` | No | - |
| `NODE_ENV` | Environment | `development` | No | Affects security settings |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/job_processor` | Yes | Use TLS in production |
| `REDIS_URI` | Redis connection string | `redis://localhost:6379` | Yes | Use TLS in production |
| `JWT_SECRET` | JWT signing secret | - | Yes | **MUST be 32+ chars** |
| `ADMIN_PASSWORD` | Dashboard admin password | - | Yes | **MUST be 12+ chars** |
| `ALLOWED_ORIGINS` | CORS allowed origins | - | No | Required for production |

### Security Requirements

**JWT Secret:**
- **Minimum 32 characters** (recommend 64+)
- Generate with: `openssl rand -base64 64`
- Must be cryptographically secure random string

**Admin Password:**
- **Minimum 12 characters**
- Must include mixed case, numbers, and symbols
- Generate with: `openssl rand -base64 32`

### Redis Configuration Notes
- **Local Redis**: `redis://localhost:6379`
- **Redis with Auth**: `redis://username:password@host:port`
- **Redis with TLS**: `rediss://username:password@host:port`
- **Upstash Example**: `rediss://default:password@host.upstash.io:port`

### MongoDB Configuration Notes
- **Local MongoDB**: `mongodb://localhost:27017/job_processor`
- **MongoDB with Auth**: `mongodb://username:password@host:port/database`
- **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net/database`

## 📚 API Documentation

### Interactive Documentation
Access the comprehensive API documentation at:
- **Swagger UI**: http://localhost:3000/api-docs
- **JSON Schema**: http://localhost:3000/api-docs.json

### Features
- **Interactive Testing**: Try API endpoints directly from the documentation
- **Request/Response Examples**: Complete examples for all endpoints
- **Authentication Guide**: Step-by-step authentication instructions
- **Schema Validation**: Input/output schema documentation

### Authentication
All API endpoints (except `/login` and `/health`) require JWT authentication:
```bash
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### POST `/api/login`
Authenticate and receive JWT token.
```json
{
  "username": "admin",
  "password": "your-admin-password"
}
```

#### POST `/api/jobs`
Create a new job.
```json
{
  "name": "sendEmail",
  "data": {
    "recipient": "user@example.com",
    "subject": "Welcome Email"
  }
}
```

#### GET `/api/jobs`
List all jobs with status and metadata.

#### GET `/api/jobs/:id`
Get specific job details by ID.

#### DELETE `/api/jobs/:id`
Cancel and remove a job.

#### POST `/api/jobs/:id/retry`
Retry a failed job.

#### GET `/health`
System health check (no auth required).

### Example Usage
```bash
# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Create Job
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"sendEmail","data":{"recipient":"test@example.com","subject":"Test"}}'

# List Jobs
curl -X GET http://localhost:3000/api/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Dashboard

Access the real-time dashboard at `http://localhost:3000/dashboard`

**Features:**
- **Job Statistics**: Total, active, completed, and failed job counts
- **Job List**: Recent jobs with status and timestamps
- **Retry Failed Jobs**: One-click retry for failed jobs
- **Auto-refresh**: Updates every 5 seconds
- **Bull Board Integration**: Advanced queue management

**Authentication:**
- Username: `admin`
- Password: Your `ADMIN_PASSWORD` from `.env`

## 🛠 Development

### Running in Development Mode
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Testing
```bash
npm test                     # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:coverage       # Coverage report
```

### Adding New Job Types

1. **Create Processor** (`src/jobs/processors/yourProcessor.js`):
```javascript
export const yourProcessor = async (job) => {
  // Your job logic here
  return { status: 'success', result: 'Job completed' };
};
```

2. **Update Worker** (`src/jobs/workers/emailWorker.js`):
```javascript
if (job.name === 'yourJobType') {
  return await yourProcessor(job);
}
```

3. **Add Validation** (`src/utils/validator.js`):
```javascript
export const validateYourJob = (data) => {
  // Joi validation schema
};
```

### Code Quality
- **ESLint**: Code linting and formatting
- **Jest**: Testing framework with comprehensive coverage
- **Security**: Input validation and sanitization

## 🚀 Production Deployment

### Security Checklist
Before deploying to production:

- [ ] **Strong Credentials**: JWT secret 64+ chars, admin password 12+ chars
- [ ] **Environment Variables**: All secrets in environment, not code
- [ ] **TLS/SSL**: Enable HTTPS for all connections
- [ ] **CORS**: Configure allowed origins
- [ ] **Rate Limiting**: Enable and configure rate limits
- [ ] **Monitoring**: Set up health check monitoring
- [ ] **Logging**: Configure log aggregation
- [ ] **Backups**: Set up database backups
- [ ] **Updates**: Keep dependencies updated

### Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Scale workers
docker-compose up -d --scale app=3
```

### Environment-Specific Configurations

**Production `.env`:**
```env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/job_processor
REDIS_URI=rediss://default:pass@redis-host:6380
JWT_SECRET=super-secure-random-string-generated-with-openssl-rand-base64-64
ADMIN_PASSWORD=very-secure-admin-password-with-special-chars-123!
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### PM2 Process Management
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start pm2.config.js

# Monitor
pm2 monit

# Logs
pm2 logs job-processor
```

### Health Monitoring
Set up monitoring for:
- `/health` endpoint
- Redis connection status
- MongoDB connection status
- Memory usage and CPU metrics
- Authentication failure rates

## 📈 Monitoring & Logging

### Logging Levels
- **Error**: System errors, failed jobs, security incidents
- **Warn**: Warnings, degraded performance, failed auth attempts
- **Info**: General information, job completion, system events
- **Debug**: Detailed debugging information (development only)

### Log Files
- `logs/combined.log`: All application logs
- Console output with colored formatting in development

### Security Monitoring
Monitor these security events:
- **Failed Authentication**: Track failed login attempts
- **Rate Limiting**: Monitor rate limit violations
- **Input Validation**: Track validation failures
- **Error Patterns**: Identify potential attack patterns

### Metrics to Monitor
- **Job Processing Rate**: Jobs per minute/hour
- **Failure Rate**: Percentage of failed jobs
- **Queue Length**: Number of pending jobs
- **Memory Usage**: Application memory consumption
- **Redis/MongoDB Connection Status**
- **Authentication Success/Failure Rates**

## 🔧 Troubleshooting

### Common Issues

**Redis Connection Timeout:**
```
Solution: Check Redis URI format and network connectivity
- Verify REDIS_URI in .env
- Test Redis connection: redis-cli ping
- Check firewall/security groups
- Ensure TLS configuration for production
```

**MongoDB Connection Failed:**
```
Solution: Verify MongoDB connection string
- Check MONGO_URI format
- Verify database credentials
- Ensure network access to MongoDB
- Check TLS/SSL requirements
```

**JWT Authentication Errors:**
```
Solution: Check JWT configuration
- Ensure JWT_SECRET is at least 32 characters
- Verify JWT_SECRET matches between sessions
- Check token expiration
- Validate issuer/audience claims
```

**Dashboard Login Failed:**
```
Solution: Check admin credentials
- Verify ADMIN_PASSWORD is set and strong (12+ chars)
- Check for special characters in password
- Ensure no hardcoded fallbacks are used
```

**Jobs Not Processing:**
```
Solution: Check worker and queue status
- Verify Redis connection
- Check worker logs for errors
- Ensure queue and worker use same Redis instance
- Monitor job queue statistics
```

**API Documentation Not Loading:**
```
Solution: Check Swagger configuration
- Verify swagger.json file exists in swagger/ directory
- Check file permissions
- Validate JSON syntax
- Check server logs for Swagger errors
```

### Debug Mode
Set `NODE_ENV=development` for:
- Detailed logging and error messages
- Full stack traces in error responses
- Additional health check information
- Swagger UI debugging features

### Performance Tuning
- **Worker Concurrency**: Adjust in `emailWorker.js`
- **Redis Memory**: Configure Redis maxmemory policy
- **MongoDB Indexes**: Add indexes for frequently queried fields
- **Rate Limiting**: Adjust limits based on usage patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure security best practices

### Security Contributions
When contributing security-related changes:
- Follow responsible disclosure practices
- Document security implications
- Add appropriate tests
- Update security documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **BullMQ**: Robust job queue implementation
- **Express.js**: Web framework
- **MongoDB**: Document database
- **Redis**: In-memory data structure store
- **Winston**: Logging library
- **Bull Board**: Queue monitoring dashboard
- **Swagger UI**: API documentation interface

---

**Built with ❤️ for reliable background job processing**

For questions or support, please open an issue or contact the development team.

**Security Notice**: This software is provided "as is" without warranty. Users are responsible for implementing appropriate security measures for their specific use case.