-- Migration 003: Slide Types, Themes, and Analysis Data
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'professional';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS risks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS decisions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER DEFAULT 0;

ALTER TABLE presentation_versions ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'professional';
