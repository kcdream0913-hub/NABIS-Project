"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send, CheckCircle2 } from "lucide-react";
import {
  FEEDBACK_KINDS,
  FEEDBACK_BODY_MAX,
  validateFeedbackBody,
  type FeedbackKind,
} from "@/lib/feedback";
import { submitFeedback } from "./actions";

const INPUT =
  "w-full rounded-md border border-border-input bg-surface px-3 py-2 text-sm text-ink focus:border-primary";

export default function FeedbackForm() {
  const t = useTranslations("settings.support");
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [body, setBody] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STATIC literal keys (not t(kind)) so the i18n usage test resolves them (code -> bundle).
  const KIND_LABELS: Record<FeedbackKind, string> = {
    bug: t("kindBug"),
    idea: t("kindIdea"),
    confusing: t("kindConfusing"),
    other: t("kindOther"),
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const check = validateFeedbackBody(body);
    if (!check.ok) {
      setError(check.error === "too_short" ? t("errorTooShort") : t("errorTooLong"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await submitFeedback({ kind, body, pagePath });
    if (res.ok) {
      setSent(true);
      return;
    }
    // A submit that FAILS must say so — the entire reason this exists is that the mailto below
    // fails silently. Map the known cases; anything else falls to the generic message.
    const map: Record<string, string> = {
      too_short: t("errorTooShort"),
      too_long: t("errorTooLong"),
      rate: t("errorRate"),
    };
    setError(map[res.error] ?? t("errorGeneric"));
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">{t("successTitle")}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{t("successBody")}</p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setBody("");
                setPagePath("");
                setKind("bug");
                setBusy(false);
                setError(null);
              }}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              {t("sendAnother")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const remaining = FEEDBACK_BODY_MAX - body.trim().length;

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink">{t("kindLabel")}</span>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
                  : "rounded-full border border-border px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-2"
              }
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="fb-body" className="mb-1.5 block text-sm font-medium text-ink">
          {t("messageLabel")}
        </label>
        <textarea
          id="fb-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={FEEDBACK_BODY_MAX + 200}
          placeholder={t("messagePlaceholder")}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-ink-soft">{t("charsRemaining", { count: remaining })}</p>
      </div>

      <div>
        <label htmlFor="fb-page" className="mb-1.5 block text-sm font-medium text-ink">
          {t("pagePathLabel")}
        </label>
        <input
          id="fb-page"
          value={pagePath}
          onChange={(e) => setPagePath(e.target.value)}
          maxLength={300}
          placeholder={t("pagePathPlaceholder")}
          className={INPUT}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="break-words rounded-md border border-accent bg-accent-soft px-2.5 py-1.5 text-[13px] text-accent"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-70"
      >
        <Send size={15} aria-hidden /> {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
