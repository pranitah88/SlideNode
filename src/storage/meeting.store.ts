export interface MeetingRecord {
  meetingId: string;
  fileName: string;
  fileSize: string;
  format: string;
  uploadedAt: string;
  durationSeconds: number;
  durationMinutes: number;
}

const meetingStore = new Map<string, MeetingRecord>();

export const addMeeting = (meeting: MeetingRecord): void => {
  meetingStore.set(meeting.meetingId, meeting);
};

export const getMeeting = (meetingId: string): MeetingRecord | undefined => {
  return meetingStore.get(meetingId);
};

export const getAllMeetings = (): MeetingRecord[] => {
  return Array.from(meetingStore.values());
};
