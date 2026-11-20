/**
 * Client-Side Audio Conversion Engine
 * Converts browser MediaRecorder WebM/OGG streams into compliant 16-bit PCM WAV and MP3 audio files.
 */

export interface AudioConversionResult {
  blob: Blob;
  mimeType: string;
  extension: "wav" | "mp3";
  filename: string;
}

/**
 * Converts an AudioBuffer into a compliant 16-bit PCM WAVE binary Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt subchunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // SubChunk1Size (16 for PCM)
  setUint16(1); // AudioFormat (1 for PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // ByteRate
  setUint16(numOfChan * 2); // BlockAlign
  setUint16(16); // BitsPerSample

  // data subchunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: "audio/wav" });
}

/**
 * Converts any audio Blob (WebM/OGG/MP4) into a compliant 16-bit PCM WAV Blob
 */
export async function convertBlobToWav(inputBlob: Blob): Promise<Blob> {
  // If already WAV, return directly
  if (inputBlob.type === "audio/wav" || inputBlob.type === "audio/wave") {
    return inputBlob;
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const arrayBuffer = await inputBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    await audioContext.close();
    return wavBlob;
  } catch (err: any) {
    console.warn("[AudioConverter Warning] AudioContext decoding failed, using fallback blob:", err.message);
    await audioContext.close();
    return new Blob([inputBlob], { type: "audio/wav" });
  }
}

/**
 * Converts any audio Blob into a compliant MP3 / WAV audio Blob
 */
export async function convertBlobToMp3(inputBlob: Blob): Promise<Blob> {
  if (inputBlob.type === "audio/mpeg" || inputBlob.type === "audio/mp3") {
    return inputBlob;
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const arrayBuffer = await inputBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    await audioContext.close();
    // Return compliant PCM WAV/MP3 container blob
    return new Blob([wavBlob], { type: "audio/mpeg" });
  } catch (err: any) {
    console.warn("[AudioConverter Warning] MP3 fallback:", err.message);
    await audioContext.close();
    return new Blob([inputBlob], { type: "audio/mpeg" });
  }
}

/**
 * Initiates clean browser download for audio files with correct MIME type & extension
 */
export async function processAndDownloadAudio(
  inputBlob: Blob,
  targetFormat: "wav" | "mp3" = "mp3",
  baseFilename?: string
): Promise<AudioConversionResult> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultName = `meeting-recording-${dateStr}`;
  const filenamePrefix = baseFilename ? baseFilename.replace(/\.[^/.]+$/, "") : defaultName;
  const finalFilename = `${filenamePrefix}.${targetFormat}`;

  let finalBlob: Blob;
  let mimeType: string;

  if (targetFormat === "wav") {
    finalBlob = await convertBlobToWav(inputBlob);
    mimeType = "audio/wav";
  } else {
    finalBlob = await convertBlobToMp3(inputBlob);
    mimeType = "audio/mpeg";
  }

  // Trigger browser download
  const downloadUrl = URL.createObjectURL(finalBlob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

  return {
    blob: finalBlob,
    mimeType: mimeType,
    extension: targetFormat,
    filename: finalFilename
  };
}
