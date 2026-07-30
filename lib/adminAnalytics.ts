import type { SupabaseClient } from "@supabase/supabase-js";

// Read-only admin analytics queries. Deliberately built on data that already
// exists — every KYC/report decision is already timestamped in `audit_logs`
// via lib/audit.ts's logAction(), called at the exact moment
// admin/dashboard.tsx's decideBusiness/decidePerson/dismissReport/actionReport
// run. That means time-to-decision is derivable from a JOIN, not a new
// column: NO schema migration backs this file. See docs/BL-ADMIN-ANALYTICS.md
// (D-068) for the join-key mapping this relies on.
//
// Scope is deliberately narrow: moderation + KYC ops metrics only (D-068).
// Platform growth/engagement metrics (signups, DAU, marketplace volume) were
// considered and explicitly deferred — a separate, larger pull if wanted later.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

type AuditLogRow = {
  action: string;
  created_at: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type KycMetrics = {
  pendingPeople: number;
  pendingBusinesses: number;
  approvedLast30d: number;
  rejectedLast30d: number;
  /** Person decisions only (needs verification_records.created_at via metadata.record_id).
   *  Business decisions can't offer a submitted-at anchor distinct from the decision
   *  itself — see the comment in getKycMetrics. null when there's no decision in-window
   *  with a resolvable submit time yet (not an error — just no data). */
  avgDecisionHours: number | null;
};

export type ReportMetrics = {
  open: number;
  resolvedLast30d: number;
  avgResolutionHours: number | null;
};

export type ModerationVolumePoint = {
  weekStart: string; // ISO date (UTC Monday) — chart x-axis key
  kycApproved: number;
  kycRejected: number;
  reportsResolved: number;
};

const KYC_ACTIONS = [
  "profile_verification_approved",
  "profile_verification_rejected",
  "business_verification_approved",
  "business_verification_rejected",
] as const;
const REPORT_ACTIONS = ["report_dismissed", "report_actioned"] as const;

/** UTC Monday of the week containing `iso`, as an ISO date string — a stable,
 *  locale-independent bucket key for weekly charts. */
function weekKeyFor(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

function hoursBetween(laterIso: string, earlierIso: string): number {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / HOUR_MS;
}

export async function getKycMetrics(supabase: SupabaseClient): Promise<KycMetrics> {
  const since30d = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [{ count: pendingPeople }, { count: pendingBusinesses }, { data: decisionLogs }] = await Promise.all([
    supabase
      .from("verification_records")
      .select("id", { count: "exact", head: true })
      .eq("subject_type", "user")
      .eq("status", "pending"),
    // Mirrors admin/dashboard.tsx's loadAll() businesses query exactly — same
    // definition of "pending" (unverified + a registration number on file).
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "unverified")
      .not("registration_number", "is", null),
    supabase
      .from("audit_logs")
      .select("action, created_at, target_type, target_id, metadata")
      .in("action", KYC_ACTIONS)
      .gte("created_at", since30d),
  ]);

  const logs = (decisionLogs ?? []) as AuditLogRow[];
  const approvedLast30d = logs.filter((r) => r.action.endsWith("_approved")).length;
  const rejectedLast30d = logs.filter((r) => r.action.endsWith("_rejected")).length;

  // Time-to-decision for PEOPLE only: decidePerson logs
  // metadata.record_id = the verification_records row that was updated, whose
  // created_at is the submission time (that row is inserted at submission,
  // well before an admin ever sees it). Businesses have no equivalent anchor:
  // decideBusiness INSERTS the verification_records row AT decision time (see
  // admin/dashboard.tsx's decideBusiness comment), so its created_at is the
  // decision time too — there is no earlier "submitted" timestamp to diff
  // against without a schema change, which D-068 deliberately avoided.
  const personDecisions = logs.filter((r) => r.action.startsWith("profile_verification_"));
  let avgDecisionHours: number | null = null;
  if (personDecisions.length > 0) {
    const recordIds = [
      ...new Set(
        personDecisions
          .map((r) => r.metadata?.record_id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];
    if (recordIds.length > 0) {
      const { data: records } = await supabase
        .from("verification_records")
        .select("id, created_at")
        .in("id", recordIds);
      const submittedAt = new Map((records ?? []).map((r) => [r.id as string, r.created_at as string]));
      const deltas = personDecisions
        .map((d) => {
          const recordId = d.metadata?.record_id as string | undefined;
          const submitted = recordId ? submittedAt.get(recordId) : undefined;
          return submitted ? hoursBetween(d.created_at, submitted) : null;
        })
        .filter((h): h is number => h !== null && h >= 0);
      if (deltas.length > 0) avgDecisionHours = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    }
  }

  return {
    pendingPeople: pendingPeople ?? 0,
    pendingBusinesses: pendingBusinesses ?? 0,
    approvedLast30d,
    rejectedLast30d,
    avgDecisionHours,
  };
}

export async function getReportMetrics(supabase: SupabaseClient): Promise<ReportMetrics> {
  const since30d = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [{ count: open }, { data: reports }, { data: resolutionLogs }] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    // Every report ever created that could plausibly be resolved in-window.
    // No date filter here (a report opened 40 days ago and resolved 2 days ago
    // must still be found) — the resolution log's own 30d filter bounds this.
    supabase.from("reports").select("id, created_at"),
    supabase
      .from("audit_logs")
      .select("action, created_at, target_id")
      .in("action", REPORT_ACTIONS)
      .gte("created_at", since30d),
  ]);

  const logs = (resolutionLogs ?? []) as AuditLogRow[];
  const resolvedLast30d = logs.length;

  const submittedAt = new Map((reports ?? []).map((r) => [r.id as string, r.created_at as string]));
  const deltas = logs
    .map((r) => {
      const submitted = r.target_id ? submittedAt.get(r.target_id) : undefined;
      return submitted ? hoursBetween(r.created_at, submitted) : null;
    })
    .filter((h): h is number => h !== null && h >= 0);
  const avgResolutionHours = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

  return { open: open ?? 0, resolvedLast30d, avgResolutionHours };
}

/** Weekly (UTC Monday-bucketed) KYC-decision and report-resolution volume,
 *  feeding both the "KYC decisions over time" and "report resolution volume"
 *  charts from a single audit_logs pull. */
export async function getModerationVolume(supabase: SupabaseClient, weeks = 8): Promise<ModerationVolumePoint[]> {
  const since = new Date(Date.now() - weeks * 7 * DAY_MS).toISOString();
  const { data } = await supabase
    .from("audit_logs")
    .select("action, created_at")
    .in("action", [...KYC_ACTIONS, ...REPORT_ACTIONS])
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const buckets = new Map<string, ModerationVolumePoint>();
  for (const row of (data ?? []) as AuditLogRow[]) {
    const key = weekKeyFor(row.created_at);
    const point = buckets.get(key) ?? { weekStart: key, kycApproved: 0, kycRejected: 0, reportsResolved: 0 };
    if (row.action.endsWith("_approved")) point.kycApproved += 1;
    else if (row.action.endsWith("_rejected")) point.kycRejected += 1;
    else point.reportsResolved += 1; // report_dismissed | report_actioned
    buckets.set(key, point);
  }
  return [...buckets.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
