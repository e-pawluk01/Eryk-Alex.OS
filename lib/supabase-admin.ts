import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY Supabase client.
//
// Uses the service_role key, which bypasses Row-Level Security. Required for
// trusted backend jobs (e.g. the monthly rollover cron) that need to INSERT /
// UPDATE rows the public anon key is not allowed to write.
//
// NEVER import this into a client component and never expose the key to the
// browser. If SUPABASE_SERVICE_ROLE_KEY is missing we still construct a client
// with a placeholder so the module doesn't throw at import time — calls will
// just fail with an auth error, which the caller handles.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is not set — admin database writes will fail.');
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey ?? 'missing-service-role-key',
  { auth: { persistSession: false, autoRefreshToken: false } }
);
