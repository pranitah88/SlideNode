import { Context } from 'hono';
import { UploadService, UploadResponse } from '../services/upload.service.js';

export class UploadController {

  public static async handleFileUpload(c: Context) {
    try {
      const body = await c.req.parseBody();
      const file = (body['file'] || body['audio']) as File | undefined;

      if (!file || !(file instanceof File)) {
        return c.json(
          {
            success: false,
            error: 'No audio file found in form data under key "file" or "audio".',
          },
          400
        );
      }

      const result: UploadResponse = await UploadService.processFile(file);

      return c.json(result, 201);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred during upload processing.';
      return c.json(
        {
          success: false,
          error: message,
        },
        400
      );
    }
  }
}
