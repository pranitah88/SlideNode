import type { MeetingResponse } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithHandleError(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = 'An error occurred';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (e) {
      // Ignored
    }
    throw new ApiError(response.status, message);
  }
  return response;
}

export const api = {
  uploadAudio: async (file: File): Promise<{ success: boolean; meeting: any }> => {
    const formData = new FormData();
    formData.append('audio', file);
    
    const response = await fetchWithHandleError(`${API_URL}/api/meetings/upload`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  getMeeting: async (meetingId: string): Promise<MeetingResponse> => {
    const response = await fetchWithHandleError(`${API_URL}/api/meetings/${meetingId}`);
    return response.json();
  },

  getPresentation: async (presentationId: string): Promise<any> => {
    const response = await fetchWithHandleError(`${API_URL}/api/presentation/${presentationId}`);
    return response.json();
  },

  modifyPresentation: async (meetingId: string, prompt: string): Promise<any> => {
    const response = await fetchWithHandleError(`${API_URL}/api/presentation/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, prompt }),
    });
    return response.json();
  },

  updatePresentation: async (presentationId: string, prompt: string): Promise<any> => {
    const response = await fetchWithHandleError(`${API_URL}/api/presentation/update-presentation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: presentationId, prompt }),
    });
    return response.json();
  },

  updateTheme: async (meetingId: string, theme: string): Promise<any> => {
    const response = await fetchWithHandleError(`${API_URL}/api/presentation/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, theme }),
    });
    return response.json();
  },

  regeneratePresentation: async (meetingId: string): Promise<any> => {
    const response = await fetchWithHandleError(`${API_URL}/api/presentation/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId }),
    });
    return response.json();
  },

  rollbackPresentation: async (presentationId: string, versionNumber: number): Promise<any> => {
    const response = await fetchWithHandleError(`${API_URL}/api/presentation/${presentationId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_number: versionNumber }),
    });
    return response.json();
  },

  getDownloadUrl: (presentationId: string, format: string) => `${API_URL}/api/presentation/${presentationId}/download/${format}`,

  getTranscriptDocxUrl: (meetingId: string) => `${API_URL}/api/meetings/${meetingId}/transcript/docx`,

  getProcessUrl: (meetingId: string) => `${API_URL}/api/meetings/${meetingId}/process`,
};
