# 🚀 Job Processing System

A production-ready background job processing system built with Node.js, Express, BullMQ, Redis, and MongoDB. Features a real-time dashboard, secure APIs, and robust job handling with retry mechanisms.

## 📋 Table of Contents

- [Features](#-features)
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

## ✨ Features

### Core Functionality
- **Background Job Processing**: Reliable job queue using BullMQ with Redis
- **Job Types**: Email processing with extensible architecture for additional job types
- **Retry Logic**: Automatic retry with exponential backoff (3 attempts)
- **Job Persistence**: MongoDB storage for job metadata and results
- **Real-time Dashboard**: Bull Board integration for job monitoring

### Security & Performance
- **JWT Authentication**: Secure API access with token-based auth
- **Rate Limiting**: Redis-backed rate limiting to prevent abuse
- **Input Validation**: Joi schema validation for all API inputs
- **CORS & Security Headers**: Helmet.js for security best practices
- **Structured Logging**: Winston logger with file and console output

### Monitoring & Operations
- **Health Checks**: System status endpoint with memory and uptime metrics
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Graceful Shutdown**: Clean process termination handling
- **Docker Support**: Full containerization with Docker Compose

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

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_PASSWORD=your-secure-admin-password

# Optional: Redis Authentication (if using cloud Redis)
REDIS_USERNAME=default
REDIS_PASSWORD=your-redis-password
REDIS_HOST=your-redis-host
REDIS_PORT=6379
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
- **Dashboard**: http://localhost:3000/dashboard (login with admin credentials)
- **API Base**: http://localhost:3000/api

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment | `development` | No |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/job_processor` | Yes |
| `REDIS_URI` | Redis connection string | `redis://localhost:6379` | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `ADMIN_PASSWORD` | Dashboard admin password | - | Yes |

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

### Authentication
All API endpoints (except `/login`) require JWT authentication:
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
npm test     # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
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
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Jest**: Testing framework

## 🚀 Production Deployment

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
JWT_SECRET=super-secure-random-string-256-bits
ADMIN_PASSWORD=very-secure-admin-password
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

## 📈 Monitoring & Logging

### Logging Levels
- **Error**: System errors, failed jobs
- **Warn**: Warnings, degraded performance
- **Info**: General information, job completion
- **Debug**: Detailed debugging information

### Log Files
- `src/combined.log`: All application logs
- Console output with colored formatting in development

### Metrics to Monitor
- **Job Processing Rate**: Jobs per minute/hour
- **Failure Rate**: Percentage of failed jobs
- **Queue Length**: Number of pending jobs
- **Memory Usage**: Application memory consumption
- **Redis/MongoDB Connection Status**

## 🔧 Troubleshooting

### Common Issues

**Redis Connection Timeout:**
```
Solution: Check Redis URI format and network connectivity
- Verify REDIS_URI in .env
- Test Redis connection: redis-cli ping
- Check firewall/security groups
```

**MongoDB Connection Failed:**
```
Solution: Verify MongoDB connection string
- Check MONGO_URI format
- Verify database credentials
- Ensure network access to MongoDB
```

**Jobs Not Processing:**
```
Solution: Check worker and queue status
- Verify Redis connection
- Check worker logs for errors
- Ensure queue and worker use same Redis instance
```

**Dashboard Not Loading:**
```
Solution: Check authentication and static files
- Verify ADMIN_PASSWORD
- Check if static files are served correctly
- Verify JWT_SECRET configuration
```

### Debug Mode
Set `NODE_ENV=development` for detailed logging and error messages.

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **BullMQ**: Robust job queue implementation
- **Express.js**: Web framework
- **MongoDB**: Document database
- **Redis**: In-memory data structure store
- **Winston**: Logging library
- **Bull Board**: Queue monitoring dashboard

---

**Built with ❤️ for reliable background job processing**

For questions or support, please open an issue or contact the development team.