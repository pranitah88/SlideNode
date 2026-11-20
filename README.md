# SlideNode

SlideNode is an AI-powered meeting intelligence and presentation generation platform. It transforms raw meeting audio into structured, executive-ready PowerPoint presentation decks and actionable insights using Google Gemini AI.

---

## Overview

Meetings are full of valuable discussions, but converting lengthy conversations into clear, professional presentation slides takes hours of manual effort. SlideNode automates this process end-to-end:

1. **Audio Ingestion & Recording**: Upload meeting audio files (MP3, WAV, M4A, WebM) or record directly in the browser.
2. **Speech-to-Text Transcription**: High-accuracy transcription converting speech into timestamped meeting transcripts.
3. **AI-Powered Meeting Intelligence**: Complete transcript analysis powered by Google Gemini AI:
   - Topic extraction and executive summary
   - Key discussion points and decisions made
   - Action items with assigned owners and deadlines
   - Numerical data and KPI extraction
   - Filtering of filler words, casual chatter, and repetitive discussion
4. **Intelligent Slide Deck Generation**: Generates clean, professional `.pptx` slides structured around core insights rather than raw conversational transcripts.
5. **Interactive Dashboard**: View meeting summaries, preview generated slides in real-time, edit slide content, and download PowerPoint presentations.

---

## System Architecture

```
User (Browser)
 │
 ├── Live Audio Recording / File Upload
 │
 ▼
Frontend (Vite + TypeScript + TailwindCSS)
 │
 ▼ HTTP REST API
Backend (Node.js + Hono + TypeScript)
 │
 ├── Supabase PostgreSQL (Meeting metadata, transcripts, slides, action items)
 ├── Supabase Storage (Private audio storage)
 │
 └── AI Intelligence Pipeline
      │
      ├── Speech-to-Text (AssemblyAI / Gemini Audio)
      │    ↓
      ├── Gemini Meeting Analysis (Chunking, Context Analysis, Deduplication)
      │    ↓
      ├── Structured Slide Planning (Executive Summary, KPIs, Tables, Bullets)
      │    ↓
      └── PPTX Engine (Dynamic Slide Layouts, Themes, Export)
```

---

## Tech Stack

- **Frontend**: Vite, TypeScript, Vanilla HTML5, TailwindCSS
- **Backend**: Node.js, TypeScript, Hono Framework
- **Database & Storage**: Supabase (PostgreSQL, Private Object Storage, RLS)
- **AI Engine**: Google Gemini API (`gemini-3.5-flash-lite`, `gemini-flash-latest`)
- **Presentation Engine**: `pptxgenjs` (dynamic PowerPoint creation)

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **pnpm**
- **Supabase Account** (Database & Storage)
- **Google Gemini API Key**

### 1. Clone the Repository

```bash
git clone https://github.com/pranitah88/SlideNode.git
cd SlideNode
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory (see `.env.example`):

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres

# AI Configuration
AI_TRANSCRIPTION_PROVIDER=gemini
AI_TRANSCRIPTION_API_KEY=your-gemini-api-key
```

Run database migrations:
```bash
npm run migrate
```

Build and start the backend:
```bash
npm run build
npm start
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend/` directory (see `.env.example`):

```env
VITE_API_URL=http://localhost:3000
```

Start the frontend development server:
```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check and server status |
| `POST` | `/api/meetings/upload` | Upload audio file and initialize meeting processing |
| `GET` | `/api/meetings/:meetingId` | Get meeting status, transcript, and generated slides |
| `POST` | `/api/meetings/:meetingId/process` | Trigger the AI transcription and slide generation pipeline |
| `GET` | `/api/presentations/:meetingId` | Fetch presentation slide details |
| `GET` | `/api/presentations/:meetingId/download` | Download generated PowerPoint presentation (`.pptx`) |

---

## License

This project is licensed under the MIT License.
