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
