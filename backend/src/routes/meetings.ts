import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.js";
import { getAudioDuration } from "../lib/audio.js";
import { calculateBillableMinutes } from "../lib/pricing.js";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { generateTranscriptDocx } from "../lib/docx.js";
import { getUserFromToken } from "../lib/auth.js";
import { executeAiPipeline } from "../lib/pipeline.js";

// ---------------------------------------------------------------------------
// Helper: Structured Logger
// ---------------------------------------------------------------------------
const logEvent = (c: any, event: string, status: string, details: any = {}) => {
  const reqId = c.get("requestId") || "unknown";
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    request_id: reqId,
    event,
    status,
    ...details
  }));
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = new Set(["mp3", "mpeg", "mpg", "wav", "m4a", "webm", "ogg", "aac", "mp4", "flac", "opus", "wma"]);

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mpeg3",
  "audio/x-mpeg-3",
  "video/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/webm",
  "audio/ogg",
  "audio/vorbis",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "application/octet-stream"
]);

const MAX_AUDIO_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const MEETING_SELECT = "*";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const meetings = new Hono();

// ===========================================================================
// POST /upload — upload audio, extract duration, save meeting record
// ===========================================================================
meetings.post(
  "/upload",
  bodyLimit({
    maxSize: 110 * 1024 * 1024,
    onError: (c) => {
      return c.json({ success: false, error: "Audio file is too large. Maximum supported size is 100 MB.", code: "FILE_TOO_LARGE" }, 413);
    },
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const audio = body["audio"] || body["file"];

    if (!audio || !(audio instanceof File)) {
      return c.json({ success: false, error: "Audio file is required", code: "NO_FILE" }, 400);
    }
    if (audio.size === 0) {
      return c.json({ success: false, error: "Audio file is empty", code: "EMPTY_FILE" }, 400);
    }
    if (audio.size > MAX_AUDIO_FILE_SIZE) {
      return c.json({ success: false, error: "Audio file is too large. Maximum supported size is 100 MB.", code: "FILE_TOO_LARGE" }, 413);
    }

    const ext = audio.name.includes(".") ? audio.name.split(".").pop()!.toLowerCase() : "";
    const isExtensionAllowed = ext && ALLOWED_EXTENSIONS.has(ext);
    const isMimeAllowed = audio.type && ALLOWED_MIME_TYPES.has(audio.type);

    if (!isExtensionAllowed && !isMimeAllowed) {
      return c.json(
        {
          success: false,
          error: `Unsupported audio format (.${ext}). Supported formats: MP3, WAV, M4A, AAC, WEBM, OGG, MP4`,
          code: "UNSUPPORTED_FORMAT"
        },
        400
      );
    }

    logEvent(c, "UPLOAD_STARTED", "pending", { file_name: audio.name, file_size: audio.size });
    const arrayBuffer = await audio.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const clientDuration = Number(body["duration_seconds"]) || Number(body["duration"]);
    let durationSeconds: number = 0;

    try {
      durationSeconds = await getAudioDuration(buffer, audio.type);
    } catch (err: any) {
      console.warn("[Audio Duration Warning] music-metadata parse warning:", err?.message || err);
    }

    if (!durationSeconds || isNaN(durationSeconds) || durationSeconds <= 0) {
      if (clientDuration && !isNaN(clientDuration) && clientDuration > 0) {
        durationSeconds = Math.round(clientDuration);
      }
    }

    if (!durationSeconds || isNaN(durationSeconds) || durationSeconds <= 0) {
      durationSeconds = 60;
    }

    const billableMinutes = calculateBillableMinutes(durationSeconds);

    console.log("[Audio] Original file name:", audio.name);
    console.log("[Audio] Original file size:", audio.size);
    console.log("[Audio] Duration:", durationSeconds, "seconds (~" + billableMinutes + " min)");

    const user = await getUserFromToken(c);
    const userId = user?.id || "anonymous";
    const meetingId = randomUUID();
    const safeFileName = audio.name.replace(/[^a-zA-Z0-9._\-]/g, "_");
    const storagePath = `${userId}/${meetingId}/${safeFileName}`;
    const meetingName = audio.name.replace(/\.[^/.]+$/, "");

    const authHeader = c.req.header("Authorization");
    const userJwt = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const authenticatedClient = (userJwt && supabaseKey)
      ? createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${userJwt}` } } })
      : supabase;

    let finalAudioPath = storagePath;

    const { error: uploadError } = await authenticatedClient.storage
      .from("audio-files")
      .upload(storagePath, buffer, {
        contentType: audio.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.warn("[Storage Warning] Uploading locally as fallback:", uploadError.message);
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const localFilePath = path.join(uploadsDir, `${meetingId}_${safeFileName}`);
      fs.writeFileSync(localFilePath, buffer);
      finalAudioPath = localFilePath;
    }

    // Ensure profile exists if user is authenticated
    if (user?.id) {
      try {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "User")
        });
      } catch (profErr: any) {
        console.warn("[Profile Upsert Warning]:", profErr?.message);
      }
    }

    const mimeType = audio.type || (ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "audio/webm");

    const insertPayload: any = {
      id: meetingId,
      user_id: user?.id || null,
      meeting_name: meetingName,
      file_name: audio.name,
      audio_path: finalAudioPath,
      audio_duration_seconds: durationSeconds,
      billable_minutes: billableMinutes,
      status: "uploaded",
    };

    let { data: meeting, error: dbError } = await supabase
      .from("meetings")
      .insert(insertPayload)
      .select("*")
      .single();

    if (dbError && dbError.message?.includes("foreign key")) {
      console.warn("[Database Warning] Retrying with user_id: null...");
      insertPayload.user_id = null;
      const retry = await supabase
        .from("meetings")
        .insert(insertPayload)
        .select("*")
        .single();
      meeting = retry.data;
      dbError = retry.error;
    }

    if (dbError) {
      console.error("[Database Error]", dbError.message);
      return c.json({ success: false, error: `Database record creation failed: ${dbError.message}`, code: "DATABASE_ERROR" }, 500);
    }

    try {
      await supabase
        .from("meetings")
        .update({
          file_size: audio.size,
          mime_type: mimeType,
          audio_format: ext || "webm",
        })
        .eq("id", meetingId);
    } catch (e: any) {
      console.warn("[Database Warning] Optional metadata column update skipped:", e.message);
    }

    logEvent(c, "UPLOAD_COMPLETED", "success", {
      meeting_id: meetingId,
      file_name: audio.name,
      duration: durationSeconds
    });

    return c.json({
      success: true,
      fileId: meetingId,
      fileName: audio.name,
      fileType: mimeType,
      fileSize: audio.size,
      duration: durationSeconds,
      storagePath: storagePath,
      meeting: {
        ...meeting,
        original_filename: audio.name,
        original_extension: ext,
        original_mime_type: mimeType,
        file_size: audio.size
      }
    }, 201);
  }
);

// ===========================================================================
// POST /:meetingId/process — Execute AI processing pipeline
// ===========================================================================
meetings.post("/:meetingId/process", async (c) => {
  const meetingId = c.req.param("meetingId");

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(meetingId)) {
    return c.json({ success: false, stage: "validation", error: "Invalid meeting ID format" }, 400);
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("status, audio_path, file_name, theme")
    .eq("id", meetingId)
    .single();

  if (error || !meeting) {
    return c.json({ success: false, stage: "validation", error: "Meeting not found" }, 404);
  }

  if (meeting.status === "completed") {
    return c.json({
      success: true,
      message: "Meeting already processed.",
      meeting_id: meetingId,
      status: "completed",
      processing: { transcript: true, slides: true, speakers: true, action_items: true }
    });
  }

  if (meeting.status === "processing") {
    return c.json({
      success: true,
      message: "Presentation generation is already in progress.",
      meeting_id: meetingId,
      status: "processing"
    }, 200);
  }

  logEvent(c, "AI_PROCESSING_STARTED", "pending", { meeting_id: meetingId });

  try {
    const result = await executeAiPipeline(meetingId);
    logEvent(c, "PROCESSING_COMPLETED", "success", { meeting_id: meetingId });

    return c.json({
      success: true,
      message: "AI processing completed successfully.",
      meeting_id: meetingId,
      status: "completed",
      processing: {
        transcript: true,
        slides: true,
        speakers: true,
        action_items: true
      }
    });
  } catch (err: any) {
    const isStructured = err && typeof err === 'object' && err.stage && err.code;
    const failureStage = isStructured ? err.stage : "AI_PROCESSING";
    const failureCode = isStructured ? err.code : "PROCESSING_FAILED";
    const safeMessage = isStructured ? err.message : (err.message || "An unexpected error occurred during processing.");

    console.error("[AI Processing Error] Stage:", failureStage, "Code:", failureCode, "Message:", safeMessage);

    logEvent(c, "PROCESSING_FAILED", "failed", {
      meeting_id: meetingId,
      failure_stage: failureStage,
      failure_code: failureCode,
      error_message: safeMessage
    });

    await supabase.from("meetings").update({
      status: "failed",
      current_stage: failureStage.toLowerCase(),
      failure_stage: failureStage,
      error_message: safeMessage
    }).eq("id", meetingId);

    return c.json({
      success: false,
      stage: failureStage,
      code: failureCode,
      error: safeMessage
    }, 500);
  }
});

// ===========================================================================
// GET /:meetingId — retrieve meeting details
// ===========================================================================
meetings.get("/:meetingId", async (c) => {
  const meetingId = c.req.param("meetingId");

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(meetingId)) {
    return c.json({ error: "Invalid meeting ID format" }, 400);
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select(MEETING_SELECT)
    .eq("id", meetingId)
    .single();

  if (error || !meeting) {
    return c.json({ error: "Meeting not found" }, 404);
  }

  const { data: speakers } = await supabase.from("speakers").select("*").eq("meeting_id", meetingId).order("created_at");
  const { data: action_items } = await supabase.from("action_items").select("*").eq("meeting_id", meetingId).order("created_at");
  const { data: slides } = await supabase.from("slides").select("*").eq("meeting_id", meetingId).order("slide_number");

  return c.json({
    success: true,
    meeting,
    speakers: speakers || [],
    action_items: action_items || [],
    slides: slides || []
  }, 200);
});

// ===========================================================================
// GET /recent/list — retrieve user's recent meetings list
// ===========================================================================
meetings.get("/recent/list", async (c) => {
  const user = await getUserFromToken(c);
  let query = supabase
    .from("meetings")
    .select("id, meeting_name, file_name, audio_duration_seconds, status, created_at, pptx_url, preview_urls, user_id")
    .order("created_at", { ascending: false })
    .limit(10);

  if (user?.id) {
    query = query.eq("user_id", user.id);
  }

  const { data: meetingsList, error } = await query;

  if (error) {
    return c.json({ success: false, error: error.message }, 500);
  }

  const formattedMeetings = (meetingsList || []).map((m: any) => {
    const isRecorded = (m.meeting_name || "").toLowerCase().includes("record") || (m.file_name || "").toLowerCase().includes("record");
    return {
      id: m.id,
      meeting_name: m.meeting_name || "Meeting Presentation",
      file_name: m.file_name,
      source: isRecorded ? "recorded" : "uploaded",
      audio_duration_seconds: m.audio_duration_seconds || 0,
      duration_minutes: Math.ceil((m.audio_duration_seconds || 0) / 60),
      status: m.status || "completed",
      created_at: m.created_at,
      pptx_url: m.pptx_url,
      preview_urls: m.preview_urls || []
    };
  });

  return c.json({ success: true, meetings: formattedMeetings }, 200);
});

// ===========================================================================
// POST /:meetingId/auto-process — Direct execution alias
// ===========================================================================
meetings.post("/:meetingId/auto-process", async (c) => {
  const meetingId = c.req.param("meetingId");
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(meetingId)) {
    return c.json({ success: false, error: "Invalid meeting ID format" }, 400);
  }

  try {
    const result = await executeAiPipeline(meetingId);
    return c.json({
      success: true,
      message: "AI pipeline executed successfully",
      meetingId,
      slides: result.aiResult.slides,
      pptx_url: result.pptxResult.storageUrl,
      preview_urls: result.previews
    }, 200);
  } catch (err: any) {
    console.error("[Auto-Process Error]", err);
    return c.json({ success: false, error: err.message || "Failed to execute AI processing pipeline" }, 500);
  }
});

// ===========================================================================
// GET /:meetingId/transcript/docx — Export transcript as Word (.docx)
// ===========================================================================
meetings.get("/:meetingId/transcript/docx", async (c) => {
  const meetingId = c.req.param("meetingId");

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(meetingId)) {
    return c.json({ success: false, error: "Invalid meeting ID format" }, 400);
  }

  const { data: meeting, error } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (error || !meeting) {
    return c.json({ success: false, error: "Meeting not found" }, 404);
  }

  if (!meeting.transcript || meeting.transcript.trim().length < 5) {
    return c.json({ success: false, error: "Transcript not available for download." }, 400);
  }

  const rawName = meeting.file_name || meeting.meeting_name || "audio_recording";
  const cleanName = rawName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `transcript_${cleanName}.docx`;

  const docxBuffer = await generateTranscriptDocx({
    meetingTitle: meeting.meeting_name || "Meeting Transcript",
    audioFileName: meeting.file_name || "audio_recording.mp3",
    generatedDate: new Date(meeting.created_at || Date.now()).toLocaleString(),
    detectedLanguage: meeting.detected_language || "English",
    transcriptText: meeting.transcript
  });

  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  c.header("Content-Disposition", `attachment; filename="${fileName}"`);
  return c.body(Uint8Array.from(docxBuffer));
});

export default meetings;
