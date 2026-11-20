"""
Database & Storage Module (Supabase) for SlideNode Python Backend
Uses httpx to interact directly with Supabase REST API and Storage using Service Role Key.
"""
import os
import json
from typing import Optional, Dict, Any, List
import httpx
from dotenv import load_dotenv

load_dotenv()
# Also check parent directory or backend/.env if not in current folder
if not os.getenv("SUPABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
if not os.getenv("SUPABASE_URL"):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def get_supabase_client() -> httpx.Client:
    return httpx.Client(base_url=f"{SUPABASE_URL}/rest/v1", headers=HEADERS, timeout=60.0)

# ── Meetings Table Helpers ──────────────────────────────────────────────────

def create_meeting(meeting_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_supabase_client() as client:
        res = client.post("/meetings", json=meeting_data)
        if res.is_success:
            data = res.json()
            return data[0] if isinstance(data, list) and data else data
        print(f"[DB Error] create_meeting failed: {res.status_code} {res.text}")
        return None

def get_meeting(meeting_id: str) -> Optional[Dict[str, Any]]:
    with get_supabase_client() as client:
        res = client.get(f"/meetings?id=eq.{meeting_id}&select=*")
        if res.is_success:
            data = res.json()
            return data[0] if isinstance(data, list) and data else None
        print(f"[DB Error] get_meeting failed: {res.status_code} {res.text}")
        return None

def update_meeting(meeting_id: str, updates: Dict[str, Any]) -> bool:
    with get_supabase_client() as client:
        res = client.patch(f"/meetings?id=eq.{meeting_id}", json=updates)
        if res.is_success:
            return True
        print(f"[DB Error] update_meeting failed: {res.status_code} {res.text}")
        return False

# ── Presentations Table Helpers ─────────────────────────────────────────────

def get_presentation_by_meeting(meeting_id: str) -> Optional[Dict[str, Any]]:
    with get_supabase_client() as client:
        res = client.get(f"/presentations?meeting_id=eq.{meeting_id}&select=*")
        if res.is_success:
            data = res.json()
            return data[0] if isinstance(data, list) and data else None
        return None

def upsert_presentation(presentation_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with get_supabase_client() as client:
        # Use resolution=merge-duplicates on meeting_id or id
        headers = {**HEADERS, "Prefer": "resolution=merge-duplicates,return=representation"}
        res = client.post(f"{SUPABASE_URL}/rest/v1/presentations", headers=headers, json=presentation_data)
        if res.is_success:
            data = res.json()
            return data[0] if isinstance(data, list) and data else data
        print(f"[DB Error] upsert_presentation failed: {res.status_code} {res.text}")
        return None

def update_presentation(meeting_id: str, updates: Dict[str, Any]) -> bool:
    with get_supabase_client() as client:
        res = client.patch(f"/presentations?meeting_id=eq.{meeting_id}", json=updates)
        return res.is_success
