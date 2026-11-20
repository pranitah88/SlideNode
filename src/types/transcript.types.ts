export interface TranscriptEntry {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface TranscriptResponse {
  meetingId: string;
  transcript: TranscriptEntry[];
}
