import { Hono } from 'hono';
import { DownloadController } from '../controllers/download.controller.js';

const downloadRouter = new Hono();

// GET /api/download/:meetingId
downloadRouter.get('/:meetingId', DownloadController.getDownloadAssets);

export default downloadRouter;