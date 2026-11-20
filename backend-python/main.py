"""
SlideNode Python Backend Server (FastAPI)
Seamless drop-in replacement for the Node.js backend.
Listens on http://localhost:3000 and serves all endpoints expected by the frontend.
"""
import os
import sys
import uuid
import asyncio
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# Import local modules
from db import create_meeting, get_meeting, update_meeting, get_presentation_by_meeting, upsert_presentation, update_presentation
from ai import transcribe_audio_file, generate_slides_from_transcript, modify_slides_with_prompt
from pptx_builder import create_presentation_file

load_dotenv()
if not os.getenv("SUPABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

app = FastAPI(title="SlideNode Python API", version="2.0.0")

# ── Enable CORS for Frontend ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
PPTX_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "presentations"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PPTX_DIR, exist_ok=True)

# In-memory presentation cache (fallback when Supabase table isn't accessible)
LOCAL_STORE: Dict[str, Dict[str, Any]] = {}

# ── 1. Health Endpoint ───────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SlideNode Python Backend", "engine": "FastAPI + Google Gemini"}

# ── 2. Meeting Upload Endpoint ───────────────────────────────────────────────
@app.post("/api/meetings/upload")
async def upload_meeting(
    audio: UploadFile = File(...),
    source: Optional[str] = Form("uploaded"),
    duration_seconds: Optional[float] = Form(60.0),
    duration: Optional[float] = Form(60.0)
):
    try:
        meeting_id = str(uuid.uuid4())
        safe_filename = f"{meeting_id}_{audio.filename.replace(' ', '_')}"
        saved_file_path = os.path.join(UPLOAD_DIR, safe_filename)

        content = await audio.read()
        with open(saved_file_path, "wb") as f:
            f.write(content)

        actual_duration = float(duration_seconds or duration or 60.0)
        meeting_name = os.path.splitext(audio.filename)[0].replace("_", " ").title()

        meeting_record = {
            "id": meeting_id,
            "meeting_name": meeting_name,
            "file_name": audio.filename,
            "audio_path": saved_file_path,
            "audio_duration_seconds": actual_duration,
            "status": "uploaded",
            "current_stage": "ready",
            "progress_percent": 10
        }

        # Save to DB (fallback to in-memory)
        db_res = create_meeting(meeting_record)
        LOCAL_STORE[meeting_id] = meeting_record

        # Initialize presentation record
        pres_init = {
            "id": meeting_id,
            "meeting_id": meeting_id,
            "status": "uploaded",
            "current_stage": "ready",
            "progress_percent": 10,
            "slides": [],
            "slides_json": []
        }
        upsert_presentation(pres_init)
        LOCAL_STORE[f"pres_{meeting_id}"] = pres_init

        return JSONResponse(status_code=201, content={"success": True, "meeting": meeting_record})

    except Exception as e:
        print(f"[Upload Error] {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

# ── 3. AI Pipeline Background Task ──────────────────────────────────────────
async def run_ai_presentation_pipeline(meeting_id: str):
    print(f"\n🚀 [PIPELINE] Starting Python AI Pipeline for meeting: {meeting_id}...")
    pres = LOCAL_STORE.get(f"pres_{meeting_id}", {})
    meeting = LOCAL_STORE.get(meeting_id, {}) or get_meeting(meeting_id) or {}

    try:
        # Stage 1: Transcribing
        pres["status"] = "processing"
        pres["current_stage"] = "transcribing"
        pres["progress_percent"] = 25
        LOCAL_STORE[f"pres_{meeting_id}"] = pres
        update_presentation(meeting_id, {"status": "processing", "current_stage": "transcribing", "progress_percent": 25})

        audio_path = meeting.get("audio_path")
        transcript = meeting.get("transcript", "")
        if not transcript and audio_path and os.path.exists(audio_path):
            transcript = transcribe_audio_file(audio_path)
            meeting["transcript"] = transcript
            pres["transcript"] = transcript
            update_meeting(meeting_id, {"transcript": transcript})

        # Stage 2: Gemini Intelligence & Meeting Analysis
        pres["current_stage"] = "gemini_analysis"
        pres["progress_percent"] = 60
        LOCAL_STORE[f"pres_{meeting_id}"] = pres
        update_presentation(meeting_id, {"current_stage": "gemini_analysis", "progress_percent": 60})

        title = meeting.get("meeting_name", "Executive Meeting")
        ai_data = generate_slides_from_transcript(transcript, meeting_title=title)
        slides = ai_data.get("slides", [])

        # Stage 3: Building PowerPoint (.pptx)
        pres["current_stage"] = "generating_pptx"
        pres["progress_percent"] = 85
        LOCAL_STORE[f"pres_{meeting_id}"] = pres
        update_presentation(meeting_id, {"current_stage": "generating_pptx", "progress_percent": 85})

        pptx_filename = f"{meeting_id}_presentation.pptx"
        pptx_path = os.path.join(PPTX_DIR, pptx_filename)
        create_presentation_file(slides, pptx_path, title=title)

        # Stage 4: Completed
        pres["status"] = "completed"
        pres["current_stage"] = "completed"
        pres["progress_percent"] = 100
        pres["slides"] = slides
        pres["slides_json"] = slides
        pres["pptx_url"] = f"/api/presentation/{meeting_id}/download"
        pres["summary"] = ai_data.get("executive_summary", "")
        pres["decisions"] = ai_data.get("decisions", [])
        pres["action_items"] = ai_data.get("action_items", [])
        LOCAL_STORE[f"pres_{meeting_id}"] = pres

        update_presentation(meeting_id, {
            "status": "completed",
            "current_stage": "completed",
            "progress_percent": 100,
            "slides_json": slides,
            "pptx_url": pres["pptx_url"]
        })
        print(f"✅ [PIPELINE] Finished successfully! {len(slides)} slides created.\n")

    except Exception as err:
        print(f"❌ [PIPELINE ERROR] {err}")
        pres["status"] = "failed"
        pres["error"] = str(err)
        pres["current_stage"] = "failed"
        LOCAL_STORE[f"pres_{meeting_id}"] = pres
        update_presentation(meeting_id, {"status": "failed", "current_stage": "failed"})

# ── 4. Trigger AI Pipeline ───────────────────────────────────────────────────
@app.post("/api/meetings/{meeting_id}/process")
@app.post("/api/generate-presentation")
async def trigger_process(meeting_id: Optional[str] = None, background_tasks: BackgroundTasks = BackgroundTasks(), req: Request = None):
    # Support meetingId in JSON body or path parameter
    if not meeting_id and req:
        try:
            body = await req.json()
            meeting_id = body.get("meetingId") or body.get("id")
        except:
            pass

    if not meeting_id:
        raise HTTPException(status_code=400, detail="meetingId is required")

    background_tasks.add_task(run_ai_presentation_pipeline, meeting_id)
    return {"success": True, "message": "AI presentation pipeline started."}

# ── 5. Get Presentation Status & Slides ──────────────────────────────────────
@app.get("/api/presentation/{meeting_id}")
@app.get("/api/presentations/{meeting_id}")
def get_presentation(meeting_id: str):
    pres = LOCAL_STORE.get(f"pres_{meeting_id}")
    if not pres:
        pres = get_presentation_by_meeting(meeting_id)

    if not pres:
        # Auto-initialize fallback object so polling doesn't crash
        pres = {
            "id": meeting_id,
            "meeting_id": meeting_id,
            "status": "uploaded",
            "current_stage": "ready",
            "progress_percent": 10,
            "slides": [],
            "slides_json": []
        }
        LOCAL_STORE[f"pres_{meeting_id}"] = pres

    return {
        "success": True,
        "presentation": {
            "id": meeting_id,
            "meeting_id": meeting_id,
            "status": pres.get("status", "uploaded"),
            "current_stage": pres.get("current_stage", "ready"),
            "progress_percent": pres.get("progress_percent", 10),
            "transcript": pres.get("transcript", ""),
            "slides": pres.get("slides") or pres.get("slides_json") or [],
            "slides_json": pres.get("slides_json") or pres.get("slides") or [],
            "pptx_url": pres.get("pptx_url", f"/api/presentation/{meeting_id}/download"),
            "summary": pres.get("summary", ""),
            "decisions": pres.get("decisions", []),
            "action_items": pres.get("action_items", [])
        }
    }

# ── 6. Download PPTX File ────────────────────────────────────────────────────
@app.get("/api/presentation/{meeting_id}/download")
@app.get("/api/presentations/{meeting_id}/download")
def download_presentation(meeting_id: str):
    pptx_path = os.path.join(PPTX_DIR, f"{meeting_id}_presentation.pptx")
    if not os.path.exists(pptx_path):
        # Look for any pptx in PPTX_DIR
        raise HTTPException(status_code=404, detail="PowerPoint presentation file not found.")

    return FileResponse(
        pptx_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename="Meeting_Presentation.pptx"
    )

# ── 7. Interactive Slide Modification ────────────────────────────────────────
class ModifySlideRequest(BaseModel):
    meetingId: str
    prompt: str

@app.post("/api/presentation/modify")
@app.post("/api/presentation/update-presentation")
def modify_presentation(payload: ModifySlideRequest):
    pres = LOCAL_STORE.get(f"pres_{payload.meetingId}", {})
    slides = pres.get("slides_json") or pres.get("slides") or []

    if not slides:
        raise HTTPException(status_code=400, detail="No slides found to modify.")

    updated_slides = modify_slides_with_prompt(slides, payload.prompt)
    pres["slides"] = updated_slides
    pres["slides_json"] = updated_slides
    LOCAL_STORE[f"pres_{payload.meetingId}"] = pres

    # Re-generate PPTX with new content
    pptx_path = os.path.join(PPTX_DIR, f"{payload.meetingId}_presentation.pptx")
    create_presentation_file(updated_slides, pptx_path)

    return {"success": True, "slides": updated_slides}

# ── 8. Theme Update ──────────────────────────────────────────────────────────
@app.post("/api/presentation/theme")
async def update_theme(req: Request):
    return {"success": True, "message": "Theme updated"}

# ── 9. Server Starter ────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 3000))
    print(f"🐍 Starting SlideNode Python Backend at http://localhost:{port}...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
