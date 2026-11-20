import fs from "fs";
import path from "path";
import { supabase } from "./supabase.js";
import { processMeetingAudio } from "./ai.js";
import { generatePptxFile } from "./pptx.js";
import { generateSlidePreviews } from "./preview.js";
import { getPexelsImageForSlide } from "./pexels.js";

export async function executeAiPipeline(meetingId: string) {
  const startTime = Date.now();

  // Fetch meeting
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (error || !meeting) {
    throw new Error("Meeting not found");
  }

  const selectedTheme = meeting.theme || "professional";

  // Diagnostic Audio Logging
  console.log("==================================================================");
  console.log(`[AUDIO] Meeting ID: ${meetingId}`);
  console.log(`[AUDIO] File name: ${meeting.file_name || meeting.meeting_name}`);
  console.log(`[AUDIO] Storage path: ${meeting.audio_path}`);
  console.log(`[AUDIO] MIME type: ${meeting.mime_type || 'audio/mpeg'}`);
  console.log(`[AUDIO] Audio duration: ${meeting.audio_duration_seconds || 0} seconds`);
  console.log("==================================================================");

  // Mark as processing
  await supabase.from("meetings").update({
    status: "processing",
    current_stage: "transcribing",
    progress_percent: 15
  }).eq("id", meetingId);

  try {
    // Step 1: Retrieve audio target
    let audioTarget = "";

    if (meeting.audio_path && fs.existsSync(meeting.audio_path)) {
      audioTarget = meeting.audio_path;
      console.log(`[AUDIO] Audio retrieval: SUCCESS (Local disk path: ${audioTarget})`);
    } else {
      const uploadsDir = path.resolve(process.cwd(), "uploads");
      const localMatch = fs.existsSync(uploadsDir)
        ? fs.readdirSync(uploadsDir).find(f => f.startsWith(meetingId))
        : null;

      if (localMatch) {
        audioTarget = path.join(uploadsDir, localMatch);
        console.log(`[AUDIO] Audio retrieval: SUCCESS (Uploads cache path: ${audioTarget})`);
      } else {
        // Download directly from Supabase Storage using Service Role Key
        try {
          console.log(`[AUDIO] Downloading audio from Supabase Storage bucket 'audio-files': ${meeting.audio_path}...`);
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("audio-files")
            .download(meeting.audio_path);

          if (!downloadError && fileData) {
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const safeName = (meeting.file_name || "audio.mp3").replace(/[^a-zA-Z0-9._\-]/g, "_");
            const tempLocalPath = path.join(uploadsDir, `${meetingId}_${safeName}`);
            const arrayBuf = await fileData.arrayBuffer();
            fs.writeFileSync(tempLocalPath, Buffer.from(arrayBuf));
            audioTarget = tempLocalPath;
            console.log(`[AUDIO] Audio retrieval: SUCCESS (Downloaded to ${tempLocalPath}, ${arrayBuf.byteLength} bytes)`);
          } else {
            console.warn(`[AUDIO Warning] Supabase storage download error: ${downloadError?.message}`);
          }
        } catch (dlErr: any) {
          console.warn("[AUDIO Warning] Storage download exception:", dlErr.message);
        }

        // Signed URL fallback
        if (!audioTarget) {
          try {
            const { data: signedUrlData } = await supabase.storage
              .from("audio-files")
              .createSignedUrl(meeting.audio_path, 3600);

            if (signedUrlData?.signedUrl) {
              audioTarget = signedUrlData.signedUrl;
              console.log(`[AUDIO] Audio retrieval: SUCCESS (Signed URL)`);
            }
          } catch (sErr: any) {
            console.warn("[AUDIO Warning] Signed URL creation failed:", sErr.message);
          }
        }

        if (!audioTarget) {
          if (meeting.audio_path && meeting.audio_path.startsWith("http")) {
            audioTarget = meeting.audio_path;
          } else {
            const supabaseUrl = process.env.SUPABASE_URL || "https://swoysdpkmpzcewdolgua.supabase.co";
            audioTarget = `${supabaseUrl}/storage/v1/object/public/audio-files/${meeting.audio_path}`;
          }
        }
      }
    }

    await supabase.from("meetings").update({
      current_stage: "transcribing",
      progress_percent: 25
    }).eq("id", meetingId);
    
    // Call AI Engine
    console.log(`[PIPELINE] Starting audio processing for meeting ${meetingId}...`);
    const aiResult = await processMeetingAudio(audioTarget, meeting.meeting_name || meeting.file_name, meeting.transcript);

    // Validation Logging
    const transcriptCharCount = (aiResult.transcript || "").length;
    const wordCount = (aiResult.transcript || "").split(/\s+/).filter(Boolean).length;
    const slideCount = aiResult.slides ? aiResult.slides.length : 0;
    const topicTitles = (aiResult.slides || []).map(s => s.title);

    console.log("==================================================================");
    console.log(`[TRANSCRIPTION] Complete: ${transcriptCharCount} characters, ~${wordCount} words`);
    console.log(`[TOPICS] EXTRACTED SLIDE TOPICS (${slideCount} slides):`);
    topicTitles.forEach((t, i) => console.log(`   Slide ${i + 1}: ${t}`));
    console.log("==================================================================");

    // Fetch topic-driven landscape photography from Pexels API for each slide
    console.log(`[IMAGES] Fetching topic-driven photography from Pexels API for ${slideCount} slides...`);
    for (let i = 0; i < aiResult.slides.length; i++) {
      const slide = aiResult.slides[i];
      try {
        const pexelsImage = await getPexelsImageForSlide(slide.title, slide.content, i + 1);
        if (pexelsImage) {
          (slide as any).image_url = pexelsImage;
        }
      } catch (imgErr: any) {
        console.warn(`[IMAGES Warning] Could not fetch Pexels image for slide ${i + 1}: ${imgErr.message}`);
      }
    }

    // Step 2 & 3: Executive Summary, Insights, Action Items & Risks
    console.log(`[PIPELINE] Saving transcript (${(aiResult.transcript || "").length} chars) and summary (${(aiResult.summary || "").length} chars) to database...`);
    
    const { error: transcriptSaveError } = await supabase.from("meetings").update({
      transcript: aiResult.transcript,
      summary: aiResult.summary,
      risks: aiResult.risks || [],
      decisions: aiResult.decisions || [],
      current_stage: "summary",
      progress_percent: 40
    }).eq("id", meetingId);

    if (transcriptSaveError) {
      console.error("[PIPELINE ERROR] Transcript/Summary save failed:", transcriptSaveError.message);
      console.error("[PIPELINE ERROR] Full error:", JSON.stringify(transcriptSaveError));
    } else {
      console.log("[PIPELINE] ✅ Transcript saved successfully");
      console.log("[PIPELINE] ✅ Summary saved successfully");
    }

    // Save detected_language separately — column may not exist in all DB schemas
    try {
      await supabase.from("meetings").update({
        detected_language: (aiResult as any).detected_language || "English"
      }).eq("id", meetingId);
      console.log("[PIPELINE] ✅ Detected language saved:", (aiResult as any).detected_language || "English");
    } catch (langErr: any) {
      console.warn("[PIPELINE Warning] detected_language column update skipped:", langErr.message);
    }

    // Step 3: Action Items
    await supabase.from("meetings").update({
      current_stage: "action_items",
      progress_percent: 55
    }).eq("id", meetingId);

    if (aiResult.action_items && aiResult.action_items.length > 0) {
      await supabase.from("action_items").delete().eq("meeting_id", meetingId);
      await supabase.from("action_items").insert(
        aiResult.action_items.map(a => ({
          meeting_id: meetingId,
          person: a.person,
          task: a.task,
          deadline: a.deadline,
          priority: a.priority,
          status: a.status
        }))
      );
    }

    // Step 4: Speakers Breakdown
    await supabase.from("meetings").update({
      current_stage: "speakers",
      progress_percent: 65
    }).eq("id", meetingId);

    if (aiResult.speakers && aiResult.speakers.length > 0) {
      await supabase.from("speakers").delete().eq("meeting_id", meetingId);
      await supabase.from("speakers").insert(
        aiResult.speakers.map(s => ({
          meeting_id: meetingId,
          speaker_name: s.name,
          total_duration_seconds: s.duration_seconds
        }))
      );
    }

    // Step 5 & 6: Slide Outline & Content
    await supabase.from("meetings").update({
      current_stage: "slide_content",
      progress_percent: 80,
      slides_json: aiResult.slides
    }).eq("id", meetingId);

    if (aiResult.slides && aiResult.slides.length > 0) {
      await supabase.from("slides").delete().eq("meeting_id", meetingId);
      await supabase.from("slides").insert(
        aiResult.slides.map(s => ({
          meeting_id: meetingId,
          slide_number: s.slide_number,
          title: s.title,
          content: typeof s.content === "string" ? s.content : JSON.stringify(s.content)
        }))
      );
    }

    // Step 7: Build Native PPTX Presentation File
    await supabase.from("meetings").update({
      current_stage: "pptx_building",
      progress_percent: 90
    }).eq("id", meetingId);

    const pptxResult = await generatePptxFile(meetingId, meeting.file_name || "Presentation", aiResult.slides, selectedTheme);

    // Step 8: Generate Slide Preview Images
    await supabase.from("meetings").update({
      current_stage: "preview_generating",
      progress_percent: 96
    }).eq("id", meetingId);

    const previews = generateSlidePreviews(meetingId, aiResult.slides, selectedTheme);
    const elapsedTime = Date.now() - startTime;

    // Save Version 1 snapshot in presentation_versions
    await supabase.from("presentation_versions").insert({
      meeting_id: meetingId,
      version_number: 1,
      prompt: "Original Deck (Initial AI Generation)",
      theme: selectedTheme,
      slides_json: aiResult.slides,
      pptx_url: pptxResult.storageUrl,
      preview_urls: previews,
    });

    // Mark as completed — also re-save transcript + summary as failsafe
    const { error: completionError } = await supabase.from("meetings").update({
      status: "completed",
      current_stage: "completed",
      progress_percent: 100,
      theme: selectedTheme,
      generation_time_ms: elapsedTime,
      pptx_url: pptxResult.storageUrl,
      preview_urls: previews,
      slides_json: aiResult.slides,
      transcript: aiResult.transcript,
      summary: aiResult.summary,
      edit_history: [{ version: 1, prompt: "Original Deck", timestamp: new Date().toISOString() }],
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    if (completionError) {
      console.error("[PIPELINE ERROR] Final completion save failed:", completionError.message);
      console.error("[PIPELINE ERROR] Full error:", JSON.stringify(completionError));
    } else {
      console.log("[PIPELINE] ✅ Meeting marked as completed with transcript + summary + slides");
    }

    return { aiResult, pptxResult, previews, elapsedTime };

  } catch (pipelineErr: any) {
    const isStructured = pipelineErr && typeof pipelineErr === "object" && pipelineErr.stage && pipelineErr.code;
    const stage = isStructured ? pipelineErr.stage : "AI_PROCESSING";
    const message = isStructured ? pipelineErr.message : (pipelineErr.message || "An unexpected error occurred during processing.");

    console.error(`[PIPELINE ERROR] Stage: ${stage}, Error: ${message}`);

    // Update meeting DB with failure stage and error details
    await supabase.from("meetings").update({
      status: "failed",
      current_stage: String(stage).toLowerCase(),
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    throw pipelineErr;
  }
}
