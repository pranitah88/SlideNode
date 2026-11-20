import { Hono } from 'hono';
import { MeetingController } from '../controllers/meeting.controller.js';

const router = new Hono();

// GET /api/meeting/:meetingId
// Route to get the details for a specific meeting
router.get('/:meetingId', MeetingController.getMeetingDetails);

export default router;
