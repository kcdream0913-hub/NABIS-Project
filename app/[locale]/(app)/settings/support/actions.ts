"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  isFeedbackKind,
  validateFeedbackBody,
  exceedsFeedbackRate,
  FEEDBACK_RATE_WINDOW_MS,
} from "@/lib/feedback";

// BL-FEEDBACK-02 capture. Runs server-side with the USER'S Supabase client (never service-role),
// so RLS (feedback_insert_own: user_id = auth.uid()) is the real authorization. The reason this
// is a server action and not a client insert: the trust-relevant columns MUST be set server-side,
// never from a client-asserted field.

export type SubmitFeedbackResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "bad_kind" | "too_short" | "too_long" | "rate" | "failed" };

export async function submitFeedback(input: {
  kind: string;
  body: string;
  pagePath?: string | null;
}): Promise<SubmitFeedbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  if (!isFeedbackKind(input.kind)) return { ok: false, error: "bad_kind" };
  const body = validateFeedbackBody(input.body ?? "");
  if (!body.ok) return { ok: false, error: body.error };

  // Rate limit: at most 5 per rolling hour. Counts only the caller's own rows (RLS scopes the
  // read); head+count avoids fetching bodies.
  const since = new Date(Date.now() - FEEDBACK_RATE_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if (exceedsFeedbackRate(count ?? 0)) return { ok: false, error: "rate" };

  // Every trust-relevant field is derived SERVER-SIDE, never from the client:
  //  - user_id  from the session (RLS also enforces user_id = auth.uid()),
  //  - locale   from the request's resolved locale,
  //  - user_agent from the request header,
  //  - app_version from the Vercel build SHA — the highest-value column: it tells KC whether a
  //    report predates a fix without asking the user anything (null off-Vercel, e.g. local dev).
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent");
  // Best-effort: locale is metadata, so a resolution failure must never fail the submit.
  let locale: string | null = null;
  try {
    locale = await getLocale();
  } catch {
    locale = null;
  }
  const appVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  // page_path is a plain optional hint ("Where did this happen?"), capped defensively.
  const pagePath = (input.pagePath ?? "").trim().slice(0, 300) || null;

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    kind: input.kind,
    body: body.value,
    page_path: pagePath,
    locale,
    user_agent: userAgent,
    app_version: appVersion,
  });
  if (error) return { ok: false, error: "failed" };
  return { ok: true };
}
