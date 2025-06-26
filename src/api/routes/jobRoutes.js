import express from 'express';
import { jobController } from '../controllers/jobController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Public route for login
router.post('/login', jobController.login);

// Protected routes
router.use(authMiddleware);
router.post('/jobs', jobController.createJob);
router.get('/jobs', jobController.getJobs);
router.get('/jobs/:id', jobController.getJobById);
router.delete('/jobs/:id', jobController.deleteJob);
router.post('/jobs/:id/retry', jobController.retryJob);

export default router;