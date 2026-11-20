# Database Architecture

SlideNode uses a PostgreSQL database hosted by Supabase.

## Tables

### 1. `meetings`
**Purpose**: The central entity representing an uploaded audio file and its lifecycle.
- `id` (UUID, Primary Key)
- `meeting_name` (Text): Derived from file name.
- `file_name` (Text)
- `audio_path` (Text): Internal path within the `audio-files` private storage bucket.
- `audio_duration_seconds` (Integer)
- `billable_minutes` (Integer)
- `price_usdc` (Numeric)
- `status` (Text): e.g., 'uploaded', 'processing', 'completed', 'failed'.
- `transcript` (Text)

### 2. `payments`
**Purpose**: Stores cryptographic payment receipts explicitly linked to a meeting to prevent replay attacks and double processing.
- `id` (UUID, Primary Key)
- `meeting_id` (UUID, Foreign Key to `meetings.id`)
- `transaction_id` (Text): The Algorand Testnet Settlement TXID.
- `amount_usdc` (Numeric)
- `currency` (Text)
- `network` (Text)
- `payment_protocol` (Text): 'x402'
- `status` (Text): e.g., 'settled'

### 3. `speakers`
**Purpose**: Maps detected speakers within a specific meeting.
- `id` (UUID, Primary Key)
- `meeting_id` (UUID, Foreign Key to `meetings.id`)
- `speaker_name` (Text)
- `total_duration_seconds` (Integer)

### 4. `action_items`
**Purpose**: Actionable tasks extracted by the AI pipeline.
- `id` (UUID, Primary Key)
- `meeting_id` (UUID, Foreign Key to `meetings.id`)
- `person` (Text)
- `task` (Text)
- `deadline` (Text)
- `priority` (Text)
- `status` (Text)

### 5. `slides`
**Purpose**: Structured slide content ready for presentation export.
- `id` (UUID, Primary Key)
- `meeting_id` (UUID, Foreign Key to `meetings.id`)
- `slide_number` (Integer)
- `title` (Text)
- `content` (Text)
