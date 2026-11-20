import { Hono } from 'hono';
import { DashboardController } from '../controllers/dashboard.controller.js';

const router = new Hono();

// GET /api/dashboard/:meetingId
// Route to get the dashboard statistics for a specific meeting
router.get('/:meetingId', DashboardController.getDashboardDetails);

export default router;
