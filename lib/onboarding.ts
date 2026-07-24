import { createClient } from "./supabase/client";
import { readPreferences, mergePreferences } from "./preferences";

// First-run state lives in profiles.preferences.onboarded (jsonb, no migration).

export async function fetchOnboarded(userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle();
  return readPreferences(data?.preferences).onboarded;
}

/** Merge-set onboarded=true so the /welcome flow never shows again (never clobbers). */
export async function markOnboarded(userId: string): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle();
  const next = mergePreferences(data?.preferences, { onboarded: true });
  await supabase.from("profiles").update({ preferences: next }).eq("id", userId);
}
