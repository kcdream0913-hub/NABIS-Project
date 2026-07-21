import type { SupabaseClient } from "@supabase/supabase-js";

export type PolicyTrack = "us" | "nepal";
export type TrackStatus = "none" | "pending" | "passed" | "failed";

export const POLICY_TRACKS: PolicyTrack[] = ["us", "nepal"];

// US and Nepal are independently regulated — each has its own document
// requirements and its own pass/fail record. A member's overall standing is
// derived from these two tracks, never from a single flag.
export async function getVerificationTracks(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<PolicyTrack, TrackStatus>> {
  const { data } = await supabase
    .from("verification_records")
    .select("policy_track, status, created_at")
    .eq("subject_type", "user")
    .eq("subject_id", userId)
    .order("created_at", { ascending: false });

  const result: Record<PolicyTrack, TrackStatus> = { us: "none", nepal: "none" };
  for (const track of POLICY_TRACKS) {
    // Records are ordered newest-first; the first match per track is current.
    const latest = data?.find((r) => r.policy_track === track);
    if (latest) result[track] = latest.status as TrackStatus;
  }
  return result;
}

// Bridge View requires BOTH the US and Nepal tracks to have passed — it is
// the layer that reconciles the two regulatory regimes, not a third,
// independent one. Do not weaken this to "either" without a deliberate
// product decision (see CLAUDE.md, 2026-07-21).
export function isBridgeEligible(tracks: Record<PolicyTrack, TrackStatus>): boolean {
  return tracks.us === "passed" && tracks.nepal === "passed";
}
