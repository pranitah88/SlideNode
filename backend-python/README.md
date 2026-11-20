# SlideNode Python Backend

A modern, fast, and lightweight **Python + FastAPI** backend for SlideNode.

---

## Features
- **FastAPI**: High-performance asynchronous API server
- **Google Gemini AI (`google-genai`)**: Audio transcription, intelligent structured meeting extraction, action items, decisions, and slide summaries
- **PowerPoint Generation (`python-pptx`)**: Generates 16:9 widescreen presentation decks dynamically
- **Zero TypeScript Required**: 100% pure Python

---

## How to Run

### 1. Configure Environment Variables
Copy `.env.example` from `../backend/.env` or make sure your `.env` contains:
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
AI_TRANSCRIPTION_API_KEY=your-gemini-api-key
```

### 2. Start the Server
```bash
python main.py
```
Or with uvicorn directly:
```bash
uvicorn main:app --port 3000 --reload
```

---

## Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Server heartbeat check |
| `POST` | `/api/meetings/upload` | Upload audio file |
| `POST` | `/api/meetings/{id}/process` | Trigger AI transcription & presentation pipeline |
| `GET` | `/api/presentation/{id}` | Get status, progress, and slide content |
| `GET` | `/api/presentation/{id}/download` | Download generated PowerPoint (`.pptx`) |
| `POST` | `/api/presentation/modify` | Interactively modify slides with AI prompts |
