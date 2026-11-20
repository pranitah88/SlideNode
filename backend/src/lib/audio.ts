import { parseBuffer } from "music-metadata";

/**
 * Extract audio duration in seconds from a buffer.
 * Normalizes MIME types and uses multi-pass metadata parsing.
 * Throws if the duration cannot be determined from buffer headers.
 */
export async function getAudioDuration(
  buffer: Buffer,
  mimeType?: string
): Promise<number> {
  let cleanMime = mimeType;
  if (!cleanMime || cleanMime === "application/octet-stream" || cleanMime === "audio/mp3") {
    cleanMime = "audio/mpeg";
  }

  // Pass 1: With normalized MIME type
  try {
    const metadata = await parseBuffer(buffer, cleanMime);
    if (metadata.format.duration && metadata.format.duration > 0) {
      return Math.round(metadata.format.duration);
    }
  } catch (err) {
    // Pass 2: Retry without explicit mimeType
    try {
      const metadata = await parseBuffer(buffer);
      if (metadata.format.duration && metadata.format.duration > 0) {
        return Math.round(metadata.format.duration);
      }
    } catch {
      // Ignored
    }
  }

  throw new Error("Unable to determine audio duration from buffer headers");
}
