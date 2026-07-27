import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-ONLY service-role client for privileged writes the caller can't perform
// under RLS — e.g. caching a server-computed post translation onto a row the
// caller doesn't own. NEVER import this from client code (it reads the
// service-role key). Returns null when the key isn't configured, so callers
// degrade gracefully (translate ephemerally, persist nothing) instead of crashing
// or — worse — falling back to a client-callable write path.
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
