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
