export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ProcessingStep = 
  | 'Audio Uploaded'
  | 'Transcribing Audio'
  | 'Speaker Detection'
  | 'Meeting Analysis'
  | 'PPT Generation'
  | 'Packaging Assets'
  | 'Completed';

export interface ProcessingState {
  meetingId: string;
  status: ProcessingStatus;
  progress: number;
  currentStep: ProcessingStep;
  estimatedTimeRemaining: string;
}
