import { MeetingRecord, getMeeting } from '../storage/meeting.store.js';

export class MeetingService {
  /**
   * Retrieves actual meeting details for a given meeting ID from the store.
   */
  public getMeetingDetails(meetingId: string): MeetingRecord | undefined {
    return getMeeting(meetingId);
  }
}

export const meetingService = new MeetingService();
