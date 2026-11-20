"""
AI Intelligence & Meeting Analysis Engine (Google Gemini)
Transcribes audio, analyzes meeting context, extracts key decisions and action items,
and structures clean, professional presentation slide content.
"""
import os
import json
import re
import time
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
if not os.getenv("AI_TRANSCRIPTION_API_KEY"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

GEMINI_API_KEY = os.getenv("AI_TRANSCRIPTION_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY", "")
PREFERRED_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
]

def get_gemini_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)

def call_gemini_with_fallback(contents: Any, system_instruction: Optional[str] = None) -> str:
    """Calls Gemini with an automatic multi-model fallback chain to ensure high reliability."""
    client = get_gemini_client()
    last_err = None

    for model_name in PREFERRED_MODELS:
        try:
            print(f"[Gemini AI] Calling model: {model_name}...")
            config = types.GenerateContentConfig()
            if system_instruction:
                config.system_instruction = system_instruction
            
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config
            )
            if response and response.text:
                return response.text
        except Exception as e:
            last_err = e
            print(f"[Gemini AI Warning] Model {model_name} failed: {e}. Trying next fallback...")
            time.sleep(1)

    raise RuntimeError(f"All Gemini models failed. Last error: {last_err}")

def parse_json_from_response(text: str) -> Dict[str, Any]:
    """Robust JSON parser that strips markdown code fences if present."""
    clean = text.strip()
    clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.MULTILINE)
    clean = re.sub(r"\s*```$", "", clean, flags=re.MULTILINE)
    clean = clean.strip()
    return json.loads(clean)

# ── 1. Speech-to-Text Transcription ──────────────────────────────────────────

def transcribe_audio_file(audio_path: str) -> str:
    """Uploads audio file to Gemini's File API and requests high-accuracy transcription."""
    print(f"[STT] Uploading audio file to Gemini File API: {audio_path}...")
    client = get_gemini_client()
    audio_file = client.files.upload(file=audio_path)
    
    print("[STT] Requesting verbatim timestamped transcript...")
    prompt = (
        "Generate a complete, high-accuracy verbatim transcription of the attached audio recording. "
        "Include speaker labels (Speaker 1, Speaker 2, etc.) where identifiable. "
        "Return ONLY the plain transcript text without any introductory commentary."
    )
    transcript = call_gemini_with_fallback(contents=[audio_file, prompt])
    return transcript.strip()

# ── 2. Intelligent Meeting Analysis & Slide Generation ───────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are an elite executive presentation designer and meeting intelligence analyst.
Your job is to read the raw meeting transcript, extract only high-value information, and structure a concise, professional PowerPoint presentation.

Rules:
1. Remove all greetings, casual small talk, filler words, and repetitive back-and-forth discussions.
2. Extract the core agenda, major decisions made, action items, owners, and deadlines.
3. Every slide must be concise (3-5 punchy bullet points, max 15 words per bullet). No lengthy paragraphs.
4. Dedicate one slide specifically to 'Decisions Made' and one slide to 'Action Items & Next Steps'.
5. Return valid JSON only with no extra commentary or markdown outside the JSON block.
"""

def generate_slides_from_transcript(transcript: str, meeting_title: str = "Executive Meeting") -> Dict[str, Any]:
    """Analyzes meeting transcript and generates structured presentation slides."""
    print(f"[Gemini AI] Analyzing transcript ({len(transcript)} chars)...")

    prompt = f"""Analyze the following meeting transcript and produce a structured executive presentation.

Meeting Title: {meeting_title}

TRANSCRIPT:
\"\"\"
{transcript[:30000]}
\"\"\"

Return ONLY a JSON object with this exact structure:
{{
  "meeting_title": "{meeting_title}",
  "executive_summary": "2-3 concise sentences summarizing the entire meeting.",
  "decisions": ["Decision 1", "Decision 2"],
  "action_items": [
    {{"task": "Action description", "owner": "Name or Role", "deadline": "Date or timeframe"}}
  ],
  "slides": [
    {{
      "slide_number": 1,
      "type": "title",
      "title": "{meeting_title}",
      "subtitle": "Executive Summary & Decisions",
      "content": ["High-level meeting overview"]
    }},
    {{
      "slide_number": 2,
      "type": "executive_summary",
      "title": "Executive Summary",
      "content": [
        "Core objective discussed in the meeting",
        "Primary conclusion reached by stakeholders",
        "Strategic focus for upcoming period"
      ]
    }},
    {{
      "slide_number": 3,
      "type": "key_topics",
      "title": "Key Discussion Points",
      "content": [
        "First key topic and its resolution",
        "Critical technical or operational finding",
        "Budgetary, timeline, or resource impact"
      ]
    }},
    {{
      "slide_number": 4,
      "type": "decisions",
      "title": "Decisions & Agreements",
      "content": [
        "Confirmed decision on technical approach",
        "Approved operational changes and policies"
      ]
    }},
    {{
      "slide_number": 5,
      "type": "action_items",
      "title": "Action Items & Responsibilities",
      "content": [
        "Task 1: Description (Owner: Responsible person, Due: Date)",
        "Task 2: Description (Owner: Responsible person, Due: Date)"
      ]
    }}
  ]
}}
"""
    raw_response = call_gemini_with_fallback(contents=prompt, system_instruction=ANALYSIS_SYSTEM_PROMPT)
    parsed = parse_json_from_response(raw_response)
    return parsed

def modify_slides_with_prompt(current_slides: List[Dict[str, Any]], user_prompt: str) -> List[Dict[str, Any]]:
    """Allows the user to interactively modify slides with natural language prompts."""
    prompt = f"""You are an executive slide designer.
Modify the following presentation slides according to the user's instructions:

USER INSTRUCTION: \"{user_prompt}\"

CURRENT SLIDES:
{json.dumps(current_slides, indent=2)}

Return ONLY the updated list of slide objects as valid JSON:
[
  {{ "slide_number": 1, "title": "...", "content": ["...", "..."], "type": "..." }}
]
"""
    raw_response = call_gemini_with_fallback(contents=prompt)
    updated = parse_json_from_response(raw_response)
    if isinstance(updated, list):
        return updated
    if isinstance(updated, dict) and "slides" in updated:
        return updated["slides"]
    return current_slides
