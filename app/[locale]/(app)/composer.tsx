"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { detectBodyLang } from "@/lib/detectLang";

export default function Composer({
  isVerified,
  onPosted,
}: {
  isVerified: boolean;
  onPosted: () => void;
}) {
  const t = useTranslations("composer");
  const supabase = createClient();
  const { view } = useApp();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function publish() {
    if (!body.trim()) return;
    setPosting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      return;
    }
    // Posts are stamped with the active country view (spec §5.6: the feed
    // is view-aware). Server-side Bridge-authoring rules (BL-TRUST-01 C3)
    // arrive with the per-track trust model — this is the display layer.
    // Detect the post's language now (Devanagari majority-script heuristic) so
    // viewers in the other locale get an auto-translation. Same rule as the DB
    // backfill — the two must never diverge.
    const trimmed = body.trim();
    await supabase.from("posts").insert({
      author_id: user.id,
      posted_as: "user",
      body: trimmed,
      body_lang: detectBodyLang(trimmed),
      view,
    });
    setBody("");
    setPosting(false);
    onPosted();
  }

  if (!isVerified) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg p-3 text-sm text-ink-soft">
        {t("verifyToPost")}{" "}
        <a href="/profile/verify" className="font-medium text-primary hover:text-primary-pressed">
          {t("verifyNow")}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={t("placeholder")}
        className="w-full resize-none border-none p-0 text-sm outline-none placeholder:text-ink-soft"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={publish}
          disabled={!body.trim() || posting}
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-40"
        >
          {posting ? t("posting") : t("post")}
        </button>
      </div>
    </div>
  );
}
