"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

export type BioReviewResult = { bioEn: string; bioNe: string; editedEn: boolean; editedNe: boolean };

// Review screen (§4/§8): the assembled EN + NE bios side by side (stacked on
// mobile), each independently editable, a Regenerate button, and a large
// "This looks right" primary. aria-live announces regeneration for screen readers.
export default function BioReview({
  assembledEn,
  assembledNe,
  regenKey,
  onRegenerate,
  onConfirm,
  saving,
}: {
  assembledEn: string;
  assembledNe: string;
  regenKey: number;
  onRegenerate: () => void;
  onConfirm: (r: BioReviewResult) => void;
  saving?: boolean;
}) {
  const t = useTranslations("guided");
  const [en, setEn] = useState(assembledEn);
  const [ne, setNe] = useState(assembledNe);
  const [editedEn, setEditedEn] = useState(false);
  const [editedNe, setEditedNe] = useState(false);

  // On regenerate the parent re-assembles and bumps regenKey → reset to the
  // fresh machine text and clear the "hand-edited" flags.
  useEffect(() => {
    setEn(assembledEn);
    setNe(assembledNe);
    setEditedEn(false);
    setEditedNe(false);
  }, [regenKey, assembledEn, assembledNe]);

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("reviewEyebrow")}</p>
      <h2 className="mt-1 text-lg font-semibold">{t("reviewTitle")}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t("reviewHint")}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2" aria-live="polite">
        <label className="block text-sm">
          <span className="font-medium text-ink">{t("bioEnLabel")}</span>
          <textarea
            value={en}
            onChange={(e) => { setEn(e.target.value); setEditedEn(true); }}
            rows={6}
            className="mt-1 w-full rounded-lg border border-border-input px-3.5 py-3 text-base leading-relaxed focus:border-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">{t("bioNeLabel")}</span>
          <textarea
            value={ne}
            onChange={(e) => { setNe(e.target.value); setEditedNe(true); }}
            rows={6}
            lang="ne"
            className="mt-1 w-full rounded-lg border border-border-input px-3.5 py-3 text-[17px] leading-loose focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1.5 rounded-lg border border-border-input px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
        >
          <RefreshCw size={15} /> {t("regenerate")}
        </button>
        <button
          type="button"
          disabled={saving || !en.trim() || !ne.trim()}
          onClick={() => onConfirm({ bioEn: en.trim(), bioNe: ne.trim(), editedEn, editedNe })}
          className="min-h-[52px] flex-1 rounded-lg bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-pressed disabled:opacity-50 sm:flex-none sm:px-8"
        >
          {saving ? t("saving") : t("looksRight")}
        </button>
      </div>
    </div>
  );
}
