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

