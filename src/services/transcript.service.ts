import { TranscriptResponse } from '../types/transcript.types.js';

export class TranscriptService {
  /**
   * Retrieves mock transcript details for a given meeting ID.
   */
  public getTranscript(meetingId: string): TranscriptResponse {
    // Return mock data as requested
    return {
      meetingId: meetingId, // Uses the param ID (or test123 depending on request)
      transcript: [
        {
          speaker: 'Speaker 1',
          timestamp: '00:00:05',
          text: 'Welcome everyone to the sprint planning meeting.'
        },
        {
          speaker: 'Speaker 2',
          timestamp: '00:00:12',
          text: "Let's review the backlog items."
        }
      ]
    };
  }
}

export const transcriptService = new TranscriptService();
