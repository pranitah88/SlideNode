# Technical Architecture

## Frontend Architecture
- **Framework**: Vite + HTML/TypeScript with TailwindCSS.
- **Routing**: Multi-page application structure (`index.html`, `payment.html`, `processing.html`, `dashboard.html`).
- **Payment Client**: Uses `@x402/fetch` to automatically intercept HTTP 402 errors, facilitate wallet signing (mocked for MVP), and interact with the facilitator.

## Backend Architecture
- **Framework**: Hono running on Node.js.
- **Observability**: Implements structured JSON logging and `X-Request-ID` generation.
- **Rate Limiting**: Lightweight in-memory rate limiting applied to the `/upload` and `/process` endpoints.
- **Protection**: Uses `@x402/hono` middleware to protect AI processing routes, parsing cryptographic receipts before continuing execution.

## Supabase Architecture
- **Database**: PostgreSQL with structured tables for `meetings`, `payments`, `speakers`, `action_items`, and `slides`.
- **Row Level Security**: The frontend has zero direct database access. The backend bypasses RLS using the securely scoped `SUPABASE_SERVICE_ROLE_KEY`.
- **Storage**: A `audio-files` bucket set to fully **private**. Files are only accessible via 1-hour signed URLs generated server-side explicitly for the AI provider.

## x402 Architecture & Algorand Flow
- The backend prices the file dynamically using `calculateBillableMinutes()`.
- When the user clicks pay, the backend responds with `402 Payment Required` and an Algorand Testnet receiver address (`AVM_ADDRESS`).
- The user signs the payment (via `mockSigner`).
- The `x402` client relays the signature to the Facilitator.
- The Facilitator broadcasts the transaction to the Algorand Testnet and issues a verifiable settlement receipt to the client.
- The client retries the AI request with the receipt. The backend validates it and stores the `transaction_id`.

## AI Processing Pipeline
- After settlement, the backend creates a signed URL for the audio file.
- The audio is sent to the Gemini API (via `@google/genai`) to generate transcripts, detect speakers, extract action items, and format slide content.
- Results are inserted transactionally into Supabase.

## Deployment Architecture
- **Local Dev**: Configured to run concurrently (Vite on `5173`, Hono on `3000`).
- **Production**: Designed to be deployed as stateless containers (e.g., Docker, Vercel for frontend, Cloud Run for backend), scaling horizontally because of the decoupled Supabase storage/database.
