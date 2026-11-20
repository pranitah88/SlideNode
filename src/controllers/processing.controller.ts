import { Context } from 'hono';
import { processingService } from '../services/processing.service.js';

export class ProcessingController {
  /**
   * GET /api/processing/:meetingId
   */
  public static async getProcessingStatus(c: Context) {
    try {
      const meetingId = c.req.param('meetingId');

      if (!meetingId) {
        return c.json(
          {
            success: false,
            error: 'Meeting ID is required',
          },
          400
        );
      }

      const state = processingService.getProcessingState(meetingId);

      return c.json(state, 200);
    } catch (error) {
      console.error('Error fetching processing status:', error);

      return c.json(
        {
          success: false,
          error: 'Internal server error while retrieving processing state',
        },
        500
      );
    }
  }
}