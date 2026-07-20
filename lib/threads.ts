import { createClient } from "@/lib/supabase/client";

/**
 * Finds an existing 1:1 direct thread between the current user and `otherUserId`,
 * or creates one — via the get_or_create_direct_thread() database function, which
 * validates the caller server-side (see supabase/schema.sql). Used by the
 * "Message" button on profile/business pages (spec §5.6).
 */
export async function findOrCreateThread(otherUserId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_direct_thread", {
    other_user_id: otherUserId,
  });
  if (error) {
    console.error(error);
    return null;
  }
  return data as string;
}
