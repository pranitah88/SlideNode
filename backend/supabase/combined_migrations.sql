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
-- =========================================================
-- SlideNode AI — Migration 002: Real Pipeline Schema
-- =========================================================

-- 1. Add pipeline and presentation fields to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS slides_json JSONB;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS pptx_url TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS preview_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'uploaded';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;

-- 2. Create presentation_versions table for storing slide deck versions & rollbacks
CREATE TABLE IF NOT EXISTS presentation_versions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id     UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  prompt         TEXT,
  slides_json    JSONB,
  pptx_url       TEXT,
  preview_urls   JSONB DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for presentation_versions
CREATE INDEX IF NOT EXISTS idx_presentation_versions_meeting_id ON presentation_versions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_presentation_versions_version ON presentation_versions(meeting_id, version_number);
-- Migration 003: Slide Types, Themes, and Analysis Data
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'professional';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS risks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS decisions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER DEFAULT 0;

ALTER TABLE presentation_versions ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'professional';
-- Migration 004: Supabase Authentication, Profiles, Wallets & User Data Isolation

-- 1. Profiles Table (matches auth.users.id)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  address     TEXT NOT NULL,
  network     TEXT DEFAULT 'Algorand Testnet',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Associate Meetings & Payments with Profiles
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Profiles Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own profile') THEN
    CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Wallets Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own wallet') THEN
    CREATE POLICY "Users can view their own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own wallet') THEN
    CREATE POLICY "Users can update their own wallet" ON wallets FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own wallet') THEN
    CREATE POLICY "Users can insert their own wallet" ON wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Meetings Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own meetings') THEN
    CREATE POLICY "Users can view their own meetings" ON meetings FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own meetings') THEN
    CREATE POLICY "Users can insert their own meetings" ON meetings FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own meetings') THEN
    CREATE POLICY "Users can update their own meetings" ON meetings FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;
-- Migration 005: Add failure tracking & audio metadata columns to meetings table

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS file_size NUMERIC,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS audio_format TEXT,
  ADD COLUMN IF NOT EXISTS failure_stage TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for faster failure queries
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_failure_stage ON meetings(failure_stage) WHERE failure_stage IS NOT NULL;

-- Migration 006: Supabase Storage Bucket & RLS Policies for audio-files
-- Ensures authenticated users and server service role can safely store meeting audio files

-- 1. Create the audio-files storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files',
  false,
  104857600, -- 100 MB limit
  ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/x-aac',
    'audio/webm',
    'audio/ogg',
    'audio/vorbis',
    'audio/flac',
    'video/mp4',
    'video/webm',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/x-aac',
    'audio/webm',
    'audio/ogg',
    'audio/vorbis',
    'audio/flac',
    'video/mp4',
    'video/webm',
    'application/octet-stream'
  ];

-- 2. Enable Row Level Security (RLS) on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Storage RLS Policies for audio-files bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users and service_role can insert audio files') THEN
    CREATE POLICY "Authenticated users and service_role can insert audio files"
      ON storage.objects
      FOR INSERT
      TO authenticated, service_role, anon
      WITH CHECK (bucket_id = 'audio-files');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users and service_role can select audio files') THEN
    CREATE POLICY "Authenticated users and service_role can select audio files"
      ON storage.objects
      FOR SELECT
      TO authenticated, service_role, anon
      USING (bucket_id = 'audio-files');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users and service_role can update audio files') THEN
    CREATE POLICY "Authenticated users and service_role can update audio files"
      ON storage.objects
      FOR UPDATE
      TO authenticated, service_role, anon
      USING (bucket_id = 'audio-files');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users and service_role can delete audio files') THEN
    CREATE POLICY "Authenticated users and service_role can delete audio files"
      ON storage.objects
      FOR DELETE
      TO authenticated, service_role, anon
      USING (bucket_id = 'audio-files');
  END IF;
END $$;
-- Migration 007: Fix payments table - add missing columns for x402 settlement
-- These columns are required by the x402 onAfterSettle handler

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_address     TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_address  TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS facilitator_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmed_at       TIMESTAMPTZ;

-- Also update the status CHECK constraint to include all valid values used in code
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('pending', 'verified', 'settled', 'failed'));

-- Add payments RLS policies (missing from migration 004!)
-- Backend uses service_role key so these only affect anon/user access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage payments' AND tablename = 'payments') THEN
    CREATE POLICY "Service role can manage payments" ON payments
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own payments' AND tablename = 'payments') THEN
    CREATE POLICY "Users can view their own payments" ON payments
      FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;
