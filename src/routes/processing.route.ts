import { Hono } from 'hono';
import { ProcessingController } from '../controllers/processing.controller.js';

const processingRouter = new Hono();

processingRouter.get('/:meetingId', ProcessingController.getProcessingStatus);

export default processingRouter;