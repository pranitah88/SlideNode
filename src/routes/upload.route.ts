import { Hono } from 'hono';
import { UploadController } from '../controllers/upload.controller.js';

const uploadRouter = new Hono();

/**
 * Route: POST /api/upload
 * Processes audio meeting uploads (MP3, WAV, M4A) and generates unique meeting IDs.
 */
uploadRouter.post('/', UploadController.handleFileUpload);

export default uploadRouter;
