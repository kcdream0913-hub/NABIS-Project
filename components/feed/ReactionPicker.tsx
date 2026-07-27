"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { REACTION_KINDS, type ReactionKind } from "@/lib/feed/reactions";

// BL-SOCIAL-02 §4.6 — the 5-kind picker. Keyboard-reachable: opens focused on the
// current (or first) kind, arrows move (roving tabindex), Enter/Space pick, Esc
// closes. Positioned by the parent; this only owns the roving row + a11y.
export default function ReactionPicker({
  current,
  onPick,
  onClose,
}: {
  current: ReactionKind | null;
  onPick: (kind: ReactionKind) => void;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const startIndex = Math.max(
    0,
    REACTION_KINDS.findIndex((r) => r.kind === current),
  );
  const [active, setActive] = useState(startIndex === -1 ? 0 : startIndex);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    btns.current[active]?.focus();
  }, [active]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % REACTION_KINDS.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + REACTION_KINDS.length) % REACTION_KINDS.length);
    }
  }

  return (
    <div
      role="menu"
      aria-label={t("reactionPickerLabel")}
      onKeyDown={onKey}
      className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-raised"
    >
      {REACTION_KINDS.map((r, i) => (
        <button
          key={r.kind}
          ref={(el) => {
            btns.current[i] = el;
          }}
          type="button"
          role="menuitemradio"
          aria-checked={current === r.kind}
          tabIndex={i === active ? 0 : -1}
          aria-label={t(`reactions.${r.kind}`)}
          title={t(`reactions.${r.kind}`)}
          onClick={() => onPick(r.kind)}
          className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition hover:scale-110 hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary ${
            current === r.kind ? "bg-primary-soft" : ""
          }`}
        >
          <span aria-hidden>{r.emoji}</span>
        </button>
      ))}
    </div>
  );
}
