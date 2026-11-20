-- =========================================================
-- SlideNode AI — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =========================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- Helper: auto-update updated_at on row changes
-- =========================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- 1. MEETINGS
-- =========================================================
CREATE TABLE IF NOT EXISTS meetings (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_name           TEXT,
  file_name              TEXT,
  audio_path             TEXT,
  audio_duration_seconds NUMERIC,
  billable_minutes       INTEGER,
  price_usdc             NUMERIC(12, 4),
  status                 TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN (
      'uploaded',
      'payment_pending',
      'payment_verified',
      'processing',
      'completed',
      'failed'
    )),
  transcript             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER trg_meetings_updated_at
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =========================================================
-- 2. PAYMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id        UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  amount_usdc       NUMERIC(12, 4),
  currency          TEXT,
  network           TEXT,
  payment_protocol  TEXT,
  transaction_id    TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'settled', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 3. SPEAKERS
-- =========================================================
CREATE TABLE IF NOT EXISTS speakers (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id             UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker_name           TEXT,
  total_duration_seconds NUMERIC,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. ACTION ITEMS
-- =========================================================
CREATE TABLE IF NOT EXISTS action_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  person      TEXT,
  task        TEXT,
  deadline    TEXT,
  priority    TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 5. SLIDES
-- =========================================================
CREATE TABLE IF NOT EXISTS slides (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  slide_number  INTEGER,
  title         TEXT,
  content       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_payments_meeting_id     ON payments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_speakers_meeting_id     ON speakers(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_slides_meeting_id       ON slides(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at     ON meetings(created_at);
