import { Hono } from 'hono';
import { TranscriptController } from '../controllers/transcript.controller.js';

const router = new Hono();

// GET /api/transcript/:meetingId
// Route to get the transcript for a specific meeting
router.get('/:meetingId', TranscriptController.getTranscript);

export default router;
