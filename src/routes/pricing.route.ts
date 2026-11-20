import { Hono } from 'hono';
import { PricingController } from '../controllers/pricing.controller.js';

const router = new Hono();

// GET /api/pricing/:meetingId
// Route to calculate and get pricing dynamically based on duration
router.get('/:meetingId', PricingController.getPricing);

export default router;
