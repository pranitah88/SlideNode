import { Context } from 'hono';
import { downloadService } from '../services/download.service.js';

export class DownloadController {
  /**
   * GET /api/download/:meetingId
   */
  public static async getDownloadAssets(c: Context) {
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

      const response = downloadService.getDownloadAssets(meetingId);

      return c.json(response, 200);
    } catch (error) {
      console.error('Error fetching download assets:', error);

      return c.json(
        {
          success: false,
          error: 'Internal server error while retrieving download assets',
        },
        500
      );
    }
  }
}