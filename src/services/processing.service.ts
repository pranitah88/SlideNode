import { ProcessingState } from '../types/processing.types';

export class ProcessingService {
  /**
   * Retrieves the current processing state for a given meeting ID.
   * Currently uses mock data as AI integration is not yet implemented.
   */
  public getProcessingState(meetingId: string): ProcessingState {
    // Return mock data
    return {
      meetingId,
      status: 'processing',
      progress: 40,
      currentStep: 'Transcribing Audio',
      estimatedTimeRemaining: '25 seconds'
    };
  }
}

export const processingService = new ProcessingService();
