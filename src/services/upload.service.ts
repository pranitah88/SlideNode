import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as mm from 'music-metadata';
import { addMeeting } from '../storage/meeting.store.js';

export interface UploadResponse {
  meetingId: string;
  fileName: string;
  fileSize: string;
  format: string;
  uploadedAt: string;
  durationSeconds: number;
  durationMinutes: number;
}

export class UploadService {
  private static readonly ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a'];
  private static readonly UPLOADS_DIR = path.resolve(process.cwd(), 'src', 'uploads');

  /**
   * Helper function to format raw byte counts into clean human-readable sizes (KB, MB).
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Processes an incoming audio file, validates format, writes it to disk, and returns metadata including duration.
   */
  public static async processFile(file: File): Promise<UploadResponse> {
    if (!file || !file.name) {
      throw new Error('No valid file object provided in request.');
    }

    const ext = path.extname(file.name).toLowerCase().replace('.', '');
    if (!this.ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported audio format '.${ext}'. Allowed formats: mp3, wav, m4a.`);
    }

    // Ensure upload storage directory exists
    if (!fs.existsSync(this.UPLOADS_DIR)) {
      fs.mkdirSync(this.UPLOADS_DIR, { recursive: true });
    }

    const meetingId = crypto.randomUUID();
    const safeFileName = `${meetingId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const targetPath = path.join(this.UPLOADS_DIR, safeFileName);

    // Convert Web File/Blob buffer to node Buffer and save to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(targetPath, buffer);

    const stat = await fs.promises.stat(targetPath);

    // Parse audio duration using music-metadata
    let durationSeconds = 0;
    try {
      const metadata = await mm.parseFile(targetPath);
      if (metadata.format.duration) {
        durationSeconds = Math.round(metadata.format.duration);
      }
    } catch (err) {
      console.warn(`Could not read metadata for file ${safeFileName}:`, err);
    }
    
    const durationMinutes = parseFloat((durationSeconds / 60).toFixed(2));

    const result = {
      meetingId,
      fileName: file.name,
      fileSize: this.formatBytes(stat.size),
      format: ext.toUpperCase(),
      uploadedAt: new Date().toISOString(),
      durationSeconds,
      durationMinutes
    };

    addMeeting(result);

    return result;
  }
}
