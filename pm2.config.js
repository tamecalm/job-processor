export default {
  apps: [
    {
      name: 'job-processor',
      script: './src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
// This PM2 configuration file defines a single application named 'job-processor'.