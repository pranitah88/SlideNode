import { Context } from 'hono';
import { transcriptService } from '../services/transcript.service.js';

export class TranscriptController {
  /**
   * GET /api/transcript/:meetingId
   * Retrieves the mock transcript for a meeting.
   */
  public static getTranscript = async (c: Context) => {
    try {
      const meetingId = c.req.param('meetingId');

      if (!meetingId) {
        return c.json({ error: 'Meeting ID is required' }, 400);
      }

      const response = transcriptService.getTranscript(meetingId);
      return c.json(response, 200);
    } catch (error) {
      console.error('Error fetching transcript details:', error);
      return c.json({ error: 'Internal server error while retrieving transcript' }, 500);
    }
  };
}
