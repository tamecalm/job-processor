# Job Processing System

## Overview
A production-ready background job processing system built with Node.js, Express, BullMQ, MongoDB. Includes a dashboard, secure APIs, and efficient job handling.

## Features
- **Job Queue**: Uses BullMQ with Redis for job processing
- **Dashboard**: Displays job stats and allows retrying failed jobs
- **Secure APIs**: JWT-based authentication
- **Validation**: Joi for input
- **Logging**: Winston for structured logging
- **Rate Limiting**: Protects login and job routes
- **Testing**: Jest for unit and integration tests
- **Dockerized**: Runs with Docker Compose
- **Setup**

### Prerequisites
- Node.js
- Docker
- Docker Compose

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-repo.git
cd job-processor
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables in `.env`:
```
MONGO_URI=mongodb://localhost:27017/job_processor
REDIS_URI=redis://localhost:6379
JWT_SECRET=your_jwt-secret
ADMIN_PASSWORD=your_admin_password
PORT=3000
```

4. Start services with Docker Compose:
```bash
docker-compose up -d
```

5. Access the app:
- API: `http://localhost:3000/api`
- Dashboard: `http://localhost:3000/dashboard`
`

## Usage

- **Run Tests**:
```bash
npm test
```

- **Run in Development**:
```bash
npm run dev
```

- **API Documentation**:
Swagger docs available at `http://localhost:3000/api-docs`
`

## Project Structure
```
job_processor/
├── src/
│   ├── config/              # Configuration files
│   ├── jobs/                # Queue and worker logic
│   ├── services/              # Business logic
│   ├── api/                  # API routes and controllers
│   ├── models/                # Mongoose schemas
│   ├── utils/                # Utilities (logger, validator)
│   ├── dashboard/            │   ├── public/               # Static files for dashboard
│   └── index.js              # Main app entry point
├── tests/                  # Unit and integration tests
├── swagger/                     # API documentation
├── docker-compose.yml         # Docker Compose configuration
├── Dockerfile               # Docker configuration
├── pm2.config.js              # PM2 configuration
└── README.md                 # Project documentation
```

## License
MIT
```

This implementation includes all core components for a production-ready job processing system. Key notes:

- **Queue**: BullMQ with Redis for reliable job processing, with a retry mechanism (3 attempts with exponential backoff).
- **Dashboard**: Uses Bull-Board for a professional interface, protected by JWT, with auto-refreshing job stats and retry functionality.
- **Security**: JWT-based auth, rate limiting, input validation with Joi, and Helmet for HTTP headers.
- **APIs**: RESTful endpoints for job management, protected and documented with Swagger.
- **Storage**: MongoDB with Mongoose for job metadata.
- **Logging**: Winston for structured logging.
- **Testing**: Jest with unit tests for services and integration tests for routes.
- **Docker**: Fully containerized with MongoDB, Redis, and PM2 for process management.
- **Health Check**: Includes `/health` endpoint with uptime and memory stats.

To keep the response concise, I included critical files like `index.js`, `queue.js`, `jobService.js`, and the dashboard UI. Additional files (e.g., more processors, full test suite, or specific configs) can be provided upon request. The system is accessible via the API at `http://localhost:3000/api` and the dashboard at `http://localhost:3000/dashboard` after login (default credentials from `.env`).

For production, use the provided Docker Compose file to spin up services, and configure environment variables in `.env`. Let me know if you need specific files expanded or additional features implemented!