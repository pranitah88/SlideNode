import { DashboardResponse } from '../types/dashboard.types.js';

export class DashboardService {
  /**
   * Retrieves mock dashboard details for a given meeting ID.
   */
  public getDashboardDetails(meetingId: string): DashboardResponse {
    // Return mock data as requested
    return {
      meetingId: meetingId, // Defaults to test123 if that's what's requested
      meetingName: 'Sprint Planning Meeting',
      duration: '18 Minutes 22 Seconds',
      slidesGenerated: 10,
      speakersDetected: 3,
      actionItems: 5,
      language: 'English',
      voiceCommandsUsed: 4,
      status: 'completed'
    };
  }
}

export const dashboardService = new DashboardService();
