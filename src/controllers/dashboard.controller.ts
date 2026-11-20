import { Context } from 'hono';
import { dashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  /**
   * GET /api/dashboard/:meetingId
   * Retrieves the mock dashboard details for a meeting.
   */
  public static getDashboardDetails = async (c: Context) => {
    try {
      const meetingId = c.req.param('meetingId');

      if (!meetingId) {
        return c.json({ error: 'Meeting ID is required' }, 400);
      }

      const response = dashboardService.getDashboardDetails(meetingId);
      return c.json(response, 200);
    } catch (error) {
      console.error('Error fetching dashboard details:', error);
      return c.json({ error: 'Internal server error while retrieving dashboard details' }, 500);
    }
  };
}
