import { DownloadResponse } from '../types/download.types';

export class DownloadService {
  /**
   * Retrieves the download assets state for a given meeting ID.
   * Currently uses mock data as AI/Database integration is not yet implemented.
   */
  public getDownloadAssets(meetingId: string): DownloadResponse {
    // Return mock data as requested
    return {
      meetingId,
      status: 'completed',
      assets: {
        ppt: 'presentation.pptx',
        pdf: 'meeting-summary.pdf',
        transcript: 'transcript.txt'
      }
    };
  }
}

export const downloadService = new DownloadService();
