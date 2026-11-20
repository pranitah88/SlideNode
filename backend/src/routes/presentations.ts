import { Hono } from "hono";
import fs from "fs";
import { supabase } from "../lib/supabase.js";
import { generatePptxFile } from "../lib/pptx.js";
import { generatePdfFile } from "../lib/pdf.js";
import { generateSlidePreviews } from "../lib/preview.js";
import { modifyPresentationWithPrompt } from "../lib/ai.js";
import { executeAiPipeline } from "../lib/pipeline.js";

const presentations = new Hono();

// ===========================================================================
// GET /api/presentation/:id — Retrieve full presentation details
// ===========================================================================
presentations.get("/:id", async (c) => {
  const meetingId = c.req.param("id");

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (error || !meeting) {
    return c.json({ success: false, error: "Presentation not found" }, 404);
  }

  const { data: speakers } = await supabase.from("speakers").select("*").eq("meeting_id", meetingId).order("created_at");
  const { data: action_items } = await supabase.from("action_items").select("*").eq("meeting_id", meetingId).order("created_at");
  const { data: slides } = await supabase.from("slides").select("*").eq("meeting_id", meetingId).order("slide_number");
  const { data: versions } = await supabase.from("presentation_versions").select("*").eq("meeting_id", meetingId).order("version_number", { ascending: false });

  const slidesData = meeting.slides_json || slides || [];
  const selectedTheme = meeting.theme || "professional";
  const previews = generateSlidePreviews(meetingId, slidesData, selectedTheme);

  return c.json({
    success: true,
    presentation: {
      meetingId: meeting.id,
      id: meeting.id,
      title: meeting.meeting_name || "Presentation Deck",
      meeting_name: meeting.meeting_name,
      file_name: meeting.file_name,
      status: meeting.status,
      theme: selectedTheme,
      generation_time_ms: meeting.generation_time_ms || 2400,
      current_stage: meeting.current_stage || meeting.status,
      progress_percent: meeting.progress_percent || (meeting.status === "completed" ? 100 : 0),
      // Failure details — populated when status === "failed"
      error: meeting.error_message || null,
      failure_stage: meeting.failure_stage || null,
      transcript: meeting.transcript,
      summary: meeting.summary || "",
      detected_language: meeting.detected_language || "English",
      risks: meeting.risks || [],
      decisions: meeting.decisions || [],
      slides_json: slidesData,
      slides: slidesData,
      pptx_url: meeting.pptx_url || `/api/presentation/${meetingId}/download/pptx`,
      preview_urls: previews,
      edit_history: meeting.edit_history || [],
      versions: versions || [],
      speakers: speakers || [],
      action_items: action_items || [],
      createdAt: meeting.created_at,
      created_at: meeting.created_at,
    }
  }, 200);
});

// ===========================================================================
// GET /api/presentation/:id/previews — Retrieve preview images/SVGs
// ===========================================================================
presentations.get("/:id/previews", async (c) => {
  const meetingId = c.req.param("id");
  const slideNumParam = c.req.query("slide");

  const { data: meeting } = await supabase.from("meetings").select("slides_json, preview_urls, theme").eq("id", meetingId).single();
  if (!meeting) {
    return c.json({ success: false, error: "Presentation not found" }, 404);
  }

  const selectedTheme = meeting.theme || "professional";
  const previews = meeting.preview_urls && meeting.preview_urls.length > 0
    ? meeting.preview_urls
    : generateSlidePreviews(meetingId, meeting.slides_json || [], selectedTheme);

  if (slideNumParam) {
    const slideNum = parseInt(slideNumParam, 10);
    const targetPreview = previews.find((p: any) => p.slide_number === slideNum) || previews[0];
    return c.json({ success: true, preview: targetPreview }, 200);
  }

  return c.json({ success: true, previews }, 200);
});

// ===========================================================================
// POST /api/presentation/modify & /update-presentation — Modify Presentation with Prompt
// ===========================================================================
const handleModifyPresentation = async (c: any) => {
  const body = await c.req.json();
  const meetingId = body.meetingId || body.id;
  const prompt = body.prompt;

  if (!meetingId || !prompt) {
    return c.json({ success: false, error: "meetingId and prompt are required" }, 400);
  }

  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (!meeting) {
    return c.json({ success: false, error: "Presentation not found" }, 404);
  }

  const selectedTheme = meeting.theme || "professional";
  const currentSlides = meeting.slides_json || [];
  console.log(`[Modify Presentation] Updating ${meetingId} with prompt: "${prompt}"`);

  // 1. Modify slides with AI
  const updatedSlides = await modifyPresentationWithPrompt(currentSlides, prompt, meeting.transcript);

  // 2. Generate new PPTX file
  const pptxResult = await generatePptxFile(meetingId, meeting.meeting_name || "Presentation", updatedSlides, selectedTheme);

  // 3. Generate preview images
  const updatedPreviews = generateSlidePreviews(meetingId, updatedSlides, selectedTheme);

  // 4. Update versions history
  const { data: existingVersions } = await supabase.from("presentation_versions").select("version_number").eq("meeting_id", meetingId).order("version_number", { ascending: false });
  const nextVersionNum = (existingVersions?.[0]?.version_number || 1) + 1;

  await supabase.from("presentation_versions").insert({
    meeting_id: meetingId,
    version_number: nextVersionNum,
    prompt: prompt,
    theme: selectedTheme,
    slides_json: updatedSlides,
    pptx_url: pptxResult.storageUrl,
    preview_urls: updatedPreviews,
  });

  const updatedEditHistory = [
    ...(meeting.edit_history || []),
    { version: nextVersionNum, prompt, timestamp: new Date().toISOString() }
  ];

  // 5. Update database record
  await supabase.from("meetings").update({
    slides_json: updatedSlides,
    pptx_url: pptxResult.storageUrl,
    preview_urls: updatedPreviews,
    edit_history: updatedEditHistory,
    updated_at: new Date().toISOString(),
  }).eq("id", meetingId);

  // 6. Update individual slides table
  await supabase.from("slides").delete().eq("meeting_id", meetingId);
  await supabase.from("slides").insert(
    updatedSlides.map(s => ({
      meeting_id: meetingId,
      slide_number: s.slide_number,
      title: s.title,
      content: typeof s.content === "string" ? s.content : JSON.stringify(s.content)
    }))
  );

  return c.json({
    success: true,
    version: nextVersionNum,
    message: `Presentation updated to Version ${nextVersionNum}`,
    slides_json: updatedSlides,
    slides: updatedSlides,
    pptx_url: pptxResult.storageUrl,
    preview_urls: updatedPreviews,
  }, 200);
};

presentations.post("/modify", handleModifyPresentation);
presentations.post("/update-presentation", handleModifyPresentation);

// ===========================================================================
// POST /api/presentation/theme — Update Presentation Theme
// ===========================================================================
presentations.post("/theme", async (c) => {
  const body = await c.req.json();
  const meetingId = body.meetingId || body.id;
  const theme = body.theme || "professional";

  if (!meetingId) {
    return c.json({ success: false, error: "meetingId is required" }, 400);
  }

  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (!meeting) {
    return c.json({ success: false, error: "Presentation not found" }, 404);
  }

  const slidesData = meeting.slides_json || [];
  const pptxResult = await generatePptxFile(meetingId, meeting.meeting_name || "Presentation", slidesData, theme);
  const updatedPreviews = generateSlidePreviews(meetingId, slidesData, theme);

  await supabase.from("meetings").update({
    theme: theme,
    pptx_url: pptxResult.storageUrl,
    preview_urls: updatedPreviews,
    updated_at: new Date().toISOString(),
  }).eq("id", meetingId);

  return c.json({
    success: true,
    theme: theme,
    message: `Theme updated to ${theme}`,
    preview_urls: updatedPreviews,
    pptx_url: pptxResult.storageUrl,
  }, 200);
});

// ===========================================================================
// POST /api/presentation/regenerate & /regenerate-slides — Re-generate slide deck
// ===========================================================================
const handleRegeneratePresentation = async (c: any) => {
  const body = await c.req.json().catch(() => ({}));
  const meetingId = body.meetingId || body.id || c.req.query("meetingId") || c.req.query("id");

  if (!meetingId) {
    return c.json({ success: false, error: "meetingId is required" }, 400);
  }

  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (!meeting) {
    return c.json({ success: false, error: "Meeting not found" }, 404);
  }

  try {
    const result = await executeAiPipeline(meetingId);
    return c.json({
      success: true,
      message: "Deck regenerated successfully",
      slides_json: result.aiResult.slides,
      slides: result.aiResult.slides,
      pptx_url: result.pptxResult.storageUrl,
      preview_urls: result.previews
    }, 200);
  } catch (err: any) {
    console.error("[Regenerate Error]", err);
    return c.json({ success: false, error: err.message || "Failed to regenerate presentation" }, 500);
  }
};

presentations.post("/regenerate", handleRegeneratePresentation);
presentations.post("/regenerate-slides", handleRegeneratePresentation);
presentations.post("/generate-presentation", handleRegeneratePresentation);

// ===========================================================================
// POST /api/presentation/:id/rollback — Rollback presentation to a previous version
// ===========================================================================
presentations.post("/:id/rollback", async (c) => {
  const meetingId = c.req.param("id");
  const body = await c.req.json();
  const versionNum = body.version_number || body.version;

  const { data: targetVersion } = await supabase
    .from("presentation_versions")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("version_number", versionNum)
    .single();

  if (!targetVersion) {
    return c.json({ success: false, error: `Version ${versionNum} not found` }, 404);
  }

  await supabase.from("meetings").update({
    slides_json: targetVersion.slides_json,
    pptx_url: targetVersion.pptx_url,
    preview_urls: targetVersion.preview_urls,
    theme: targetVersion.theme || "professional",
    updated_at: new Date().toISOString(),
  }).eq("id", meetingId);

  return c.json({
    success: true,
    message: `Rolled back to Version ${versionNum}`,
    version: targetVersion,
  }, 200);
});

// ===========================================================================
// GET /api/presentation/:id/download/:format — Download PPTX / PDF / Images
// ===========================================================================
presentations.get("/:id/download/:format", async (c) => {
  const meetingId = c.req.param("id");
  const format = c.req.param("format").toLowerCase();

  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (!meeting) {
    return c.json({ success: false, error: "Presentation not found" }, 404);
  }

  const slidesData = meeting.slides_json || [];
  const selectedTheme = meeting.theme || "professional";

  if (format === "pptx") {
    const pptxResult = await generatePptxFile(meetingId, meeting.meeting_name || "Presentation", slidesData, selectedTheme);
    c.header("Content-Disposition", `attachment; filename="${meeting.meeting_name || "Presentation"}.pptx"`);
    c.header("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    return c.body(Uint8Array.from(fs.readFileSync(pptxResult.filePath)));
  }

  if (format === "images" || format === "png") {
    const previews = generateSlidePreviews(meetingId, slidesData, selectedTheme);
    return c.json({ success: true, message: "Slide previews generated", images: previews }, 200);
  }

  if (format === "pdf") {
    const pdfResult = await generatePdfFile(meetingId, meeting.meeting_name || "Presentation", slidesData, selectedTheme);
    c.header("Content-Disposition", `attachment; filename="${meeting.meeting_name || "Presentation"}.pdf"`);
    c.header("Content-Type", "application/pdf");
    return c.body(Uint8Array.from(fs.readFileSync(pdfResult.filePath)));
  }

  return c.json({ success: false, error: `Unsupported format: ${format}` }, 400);
});

export default presentations;
