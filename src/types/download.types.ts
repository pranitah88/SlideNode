export interface DownloadAssets {
  ppt: string;
  pdf: string;
  transcript: string;
}

export interface DownloadResponse {
  meetingId: string;
  status: string;
  assets: DownloadAssets;
}
