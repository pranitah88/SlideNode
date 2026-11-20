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
