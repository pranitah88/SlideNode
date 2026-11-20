# SlideNode API

Backend API for **SlideNode AI** — Voice to Slide Deck Node (PS0402).

Built with [Hono](https://hono.dev), Node.js, and TypeScript.

## Installation

```bash
cd backend
npm install
```

## Development

```bash
npm run dev
```

The server starts at **http://localhost:3000** with hot-reload via `tsx watch`.

## Build

```bash
npm run build
```

## Start (Production)

```bash
npm run start
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → API**.
3. Copy the **API URL** → `SUPABASE_URL` in `.env`.
4. Copy the **service_role / secret key** → `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

> **Security:** Never expose the service-role key to the frontend, commit it to Git, or log it in API responses.

## Database

| Table | Description |
|-------|-------------|
| `meetings` | Meeting metadata, audio path, transcript, billing |
| `payments` | x402 / USDC payment records per meeting |
| `speakers` | Detected speakers and speaking duration |
| `action_items` | AI-extracted action items with priority |
| `slides` | Generated slide content per meeting |

### Running the Migration

```bash
npm run migrate
```

## Audio Upload

### Setup Storage Bucket

```bash
npm run setup-storage
```

### Upload Endpoint

```
POST /api/meetings/upload
```

**Content-Type:** `multipart/form-data`  
**Field:** `audio`  
**Supported formats:** mp3, wav, m4a, webm, ogg  
**Maximum file size:** 100 MB

**Example:**

```bash
curl -X POST http://localhost:3000/api/meetings/upload \
  -F "audio=@meeting.mp3"
```

**Success response** (HTTP 201):

```json
{
  "success": true,
  "meeting": {
    "id": "550e8400-...",
    "meeting_name": "meeting",
    "file_name": "meeting.mp3",
    "audio_duration_seconds": 1102,
    "billable_minutes": 19,
    "price_usdc": "7.60",
    "status": "uploaded"
  }
}
```

## Duration & Pricing

Audio duration is extracted automatically on upload using `music-metadata`.

### Billable Minutes

```
billable_minutes = ceil(audio_duration_seconds / 60)
```

| Duration | Billable Minutes |
|----------|-----------------|
| 30 s | 1 min |
| 60 s | 1 min |
| 61 s | 2 min |
| 121 s | 3 min |

### Pricing Formula

```
price_usdc = billable_minutes × AI_PRICE_PER_MINUTE_USDC
```

**Current rate:** `0.40` USDC per minute.

Configure via the `AI_PRICE_PER_MINUTE_USDC` environment variable in `.env`.

| Minutes | Price |
|---------|-------|
| 1 | 0.40 USDC |
| 5 | 2.00 USDC |
| 10 | 4.00 USDC |
| 18 | 7.20 USDC |

## Get Meeting

```
GET /api/meetings/:meetingId
```

**Response** (HTTP 200):

```json
{
  "success": true,
  "meeting": {
    "id": "...",
    "meeting_name": "Sprint Planning",
    "file_name": "Sprint_Planning.mp3",
    "audio_duration_seconds": 1102,
    "billable_minutes": 19,
    "price_usdc": "7.60",
    "status": "uploaded"
  }
}
```

## Health Endpoint

```
GET /health
```

**Response** (HTTP 200):

```json
{
  "status": "ok",
  "service": "SlideNode API",
  "supabase": "configured"
}
```
