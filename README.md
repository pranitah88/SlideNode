# SlideNode

SlideNode converts meeting audio into structured presentation-ready outputs while using x402 and Algorand for pay-per-use AI processing.

## Problem Statement

Meeting audio contains valuable information but converting it into structured presentation material is time-consuming. Traditionally, AI tools that solve this problem are locked behind expensive monthly subscriptions, making them inaccessible for sporadic usage. SlideNode solves this by offering a dynamic pay-per-use AI model, allowing users to pay only for the exact audio they process.

## Solution

SlideNode allows users to upload meeting audio and pay only for the audio they process.

After successful x402 payment:
- audio is processed
- transcript is generated
- speakers are identified
- action items are extracted
- presentation slides are generated

## Why x402

The x402 protocol enables machine-to-machine micro-payments natively over HTTP.

**Payment Flow:**
1. Client requests a paid API service.
2. Server returns HTTP 402 Payment Required.
3. x402 client receives payment requirements.
4. Client signs a USDC payment transaction.
5. Client retries request with the payment signature.
6. Facilitator verifies the signature.
7. Facilitator settles the transaction.
8. API access is granted by the backend.

Payment happens strictly per-use instead of through a subscription.

## Why Algorand

Algorand acts as the decentralized settlement layer for our pay-per-use architecture.
- **Fast Settlement:** Algorand settles transactions in roughly 3 seconds, meaning users aren't waiting to access their AI outputs.
- **Low-cost Micropayments:** Transaction fees are fractions of a cent, making micropayments viable.
- **Blockchain-verifiable:** Provides a cryptographic, immutable transaction receipt that the backend can trust for idempotency.
- **Suitability:** It is perfectly suited for high-frequency, pay-per-use services.

*Current MVP operates on the **Algorand Testnet**.*

## Payment Model

- **Rate:** 0.40 USDC per billable minute
- **Billing:** `billable_minutes = ceil(audio_duration_seconds / 60)`

**Example:**
- 18 minutes 22 seconds
- → 19 billable minutes
- → 7.60 USDC

*Current implementation uses Testnet USDC.*

## Architecture

```
User
 ↓
Frontend
 ↓
Hono Backend
 ├── Supabase Database
 ├── Supabase Private Storage
 ├── x402
 │    ↓
 │  Facilitator
 │    ↓
 │  Algorand Testnet
 │    ↓
 │  USDC ASA
 │
 └── AI Provider
      ↓
 Transcript
      ↓
 Slides
 Speakers
 Action Items
```

## Tech Stack

- **Frontend**: Vite, TypeScript, HTML, TailwindCSS
- **Backend**: Node.js, TypeScript, Hono
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Payment protocol**: `@x402/core`, `@x402/hono`, `@x402/fetch`
- **Blockchain**: Algorand Testnet, USDC ASA
- **AI Provider**: Google Gemini

## API Documentation

### `GET /health`
- **Purpose**: Health check endpoint.
- **Method**: GET
- **Request**: No parameters.
- **Response**: `{ "status": "ok", "service": "SlideNode API" }`
- **Payment requirement**: None
- **Common errors**: None

### `POST /api/meetings/upload`
- **Purpose**: Uploads audio, calculates duration/price, and creates meeting record.
- **Method**: POST
- **Request**: Multipart form-data containing `audio` file.
- **Response**: `201 Created` with meeting record.
- **Payment requirement**: None
- **Common errors**: `400` Invalid format, `413` File too large, `429` Rate limit.

### `GET /api/meetings/:meetingId`
- **Purpose**: Fetches the meeting status, payment details, and generated insights.
- **Method**: GET
- **Request**: `meetingId` UUID path parameter.
- **Response**: `200 OK` with meeting details.
- **Payment requirement**: None
- **Common errors**: `404` Meeting not found.

### `POST /api/meetings/:meetingId/process`
- **Purpose**: Triggers AI pipeline upon payment settlement.
- **Method**: POST
- **Request**: `meetingId` UUID path parameter.
- **Response**: `200 OK` with successful AI generation results.
- **Payment requirement**: Yes. Protected by x402 middleware requiring Algorand settlement.
- **Common errors**: `402` Payment Required, `404` Meeting not found, `429` Rate limit.

## Local Setup

1. Clone repository
2. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Configure `.env` using `.env.example` in both folders.
4. Configure Supabase (create project, run `npm run migrate` in backend).
5. Configure Algorand Testnet (create test wallet, get test USDC).
6. Configure x402 facilitator (update `AVM_ADDRESS` in `.env`).
7. Configure AI provider (update `AI_PROVIDER_API_KEY` in `.env`).
8. Start backend:
   ```bash
   cd backend
   npm run build
   npm start
   ```
9. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```

## Environment Variables

### Frontend Variables
- `VITE_API_URL`: Backend URL (e.g., `http://localhost:3000`)

### Backend Variables
- `PORT`: Port for the API
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: **(SECRET)** Supabase Service Role Key
- `AVM_ADDRESS`: Algorand receiver address
- `AI_PROVIDER_API_KEY`: **(SECRET)** Gemini API Key

*Never commit actual secret values.*

## Supabase Setup

The following tables are created via the provided backend migrations:
- `meetings`
- `payments`
- `speakers`
- `action_items`
- `slides`

**Storage**: The `audio-files` bucket is used to store uploaded meeting files. This bucket **must remain private**.

## x402 Payment Flow

1. User requests processing.
2. Server checks meeting price.
3. Server returns HTTP 402.
4. x402 client receives payment requirements.
5. Client signs Algorand USDC payment.
6. Client retries request.
7. Facilitator verifies payment.
8. Facilitator settles payment.
9. Transaction ID is returned.
10. Payment is stored in Supabase.
11. AI processing starts.

## AI Pipeline

```
Audio
 ↓
Transcription
 ↓
Structured analysis
 ├── Speakers
 ├── Action Items
 └── Slide Content
 ↓
Database
 ↓
Frontend Insights
```

## Security

- Private Supabase Storage.
- Service role key server-side only.
- AI API key server-side only.
- Payment verification server-side.
- Environment-based secrets.
- No private keys in frontend.
- No fake payment confirmation.

## Testnet Disclaimer

This MVP uses Algorand Testnet and testnet USDC for demonstration purposes.

Mainnet deployment is a future production step requiring production wallet/security configuration and appropriate USDC asset configuration. This application does not currently handle real-money Mainnet payments.

## Project Structure

```
frontend/        - Vite + HTML application
backend/         - Hono + Node.js API
docs/            - Technical and judging documentation
README.md        - Core project documentation
```
