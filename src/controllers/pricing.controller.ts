import { Context } from 'hono';
import { pricingService } from '../services/pricing.service.js';

export class PricingController {
  /**
   * GET /api/pricing/:meetingId
   * Retrieves dynamic pricing based on actual uploaded audio duration.
   */
  public static getPricing = async (c: Context) => {
    try {
      const meetingId = c.req.param('meetingId');

      if (!meetingId) {
        return c.json({ error: 'Meeting ID is required' }, 400);
      }

      const response = pricingService.calculatePricing(meetingId);
      return c.json(response, 200);
    } catch (error: any) {
      console.error('Error fetching pricing details:', error);
      
      if (error.message === 'Meeting not found') {
        return c.json({ success: false, error: 'Meeting not found' }, 404);
      }
      
      return c.json({ error: 'Internal server error while calculating pricing' }, 500);
    }
  };
}
