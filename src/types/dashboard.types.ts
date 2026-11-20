export interface DashboardResponse {
  meetingId: string;
  meetingName: string;
  duration: string;
  slidesGenerated: number;
  speakersDetected: number;
  actionItems: number;
  language: string;
  voiceCommandsUsed: number;
  status: string;
}
