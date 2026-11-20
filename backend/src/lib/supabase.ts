import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing SUPABASE_URL – set it in the .env file. See .env.example for reference."
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "Missing SUPABASE_SERVICE_ROLE_KEY – set it in the .env file. See .env.example for reference."
  );
}

/**
 * Server-side Supabase client using the service-role key.
 * Never expose this client or its credentials to the frontend.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
