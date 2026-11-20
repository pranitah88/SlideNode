import { Context } from 'hono';
import { meetingService } from '../services/meeting.service.js';

export class MeetingController {
  /**
   * GET /api/meeting/:meetingId
   * Retrieves the actual meeting details for a meeting.
   */
  public static getMeetingDetails = async (c: Context) => {
    try {
      const meetingId = c.req.param('meetingId');

      if (!meetingId) {
        return c.json({ error: 'Meeting ID is required' }, 400);
      }

      const meeting = meetingService.getMeetingDetails(meetingId);

      if (!meeting) {
        return c.json({
          success: false,
          error: 'Meeting not found'
        }, 404);
      }

      return c.json(meeting, 200);
    } catch (error) {
      console.error('Error fetching meeting details:', error);
      return c.json({ error: 'Internal server error while retrieving meeting details' }, 500);
    }
  };
}
