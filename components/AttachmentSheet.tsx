"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Plus } from "lucide-react";
import { ACCEPT_CAMERA, ACCEPT_DOCUMENT, ACCEPT_MEDIA } from "@/lib/attachments";

export type AttachmentSource = "document" | "media" | "camera";

// WhatsApp-style "+" attachment picker (BL-MSG-05). Click/tap ONLY — no hover-open,
// no long-press (D-032: Nepal is ~75% Android). Bottom sheet < 768px, popover ≥ 768px.
// A11y: real <button> trigger with aria-expanded + aria-haspopup="menu"; Esc closes
// and returns focus to the trigger; an outside pointerdown closes it. Exactly three
// rows — Document · Photos & videos · Camera (Phase 1).
export default function AttachmentSheet({
  onPick,
  disabled,
  labels,
}: {
  onPick: (files: FileList, source: AttachmentSource) => void;
  disabled?: boolean;
  labels: { add: string; document: string; media: string; camera: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // Esc closes + returns focus to the trigger; outside pointerdown closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-attach-ui="${menuId}"]`)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    firstRowRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, menuId]);

  function choose(ref: React.RefObject<HTMLInputElement | null>) {
    setOpen(false);
    ref.current?.click();
  }

  function handle(source: AttachmentSource, ref: React.RefObject<HTMLInputElement | null>, files: FileList | null) {
    if (files && files.length) onPick(files, source);
    if (ref.current) ref.current.value = ""; // allow re-picking the same file
  }

  const ROW = "flex w-full items-center gap-3 rounded-lg px-3 text-left text-sm min-h-[56px] hover:bg-surface-2 md:min-h-[44px]";
  const ICON = "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary";

  return (
    <div className="relative shrink-0" data-attach-ui={menuId}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.add}
        className="grid h-10 w-10 place-items-center rounded-md text-ink-soft hover:bg-bg hover:text-ink disabled:opacity-40"
      >
        <Plus size={20} />
      </button>

      {/* hidden source inputs */}
      <input ref={docInput} type="file" accept={ACCEPT_DOCUMENT} multiple hidden onChange={(e) => handle("document", docInput, e.target.files)} />
      <input ref={mediaInput} type="file" accept={ACCEPT_MEDIA} multiple hidden onChange={(e) => handle("media", mediaInput, e.target.files)} />
      <input ref={cameraInput} type="file" accept={ACCEPT_CAMERA} capture="environment" hidden onChange={(e) => handle("camera", cameraInput, e.target.files)} />

      {open && (
        <>
          {/* mobile backdrop */}
          <div className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={labels.add}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface p-2 shadow-lg md:absolute md:inset-x-auto md:bottom-full md:left-0 md:mb-2 md:w-64 md:rounded-xl md:border md:shadow-card"
          >
            <button ref={firstRowRef} type="button" role="menuitem" onClick={() => choose(docInput)} className={ROW}>
              <span className={ICON}><FileText size={18} /></span>
              {labels.document}
            </button>
            <button type="button" role="menuitem" onClick={() => choose(mediaInput)} className={ROW}>
              <span className={ICON}><ImageIcon size={18} /></span>
              {labels.media}
            </button>
            <button type="button" role="menuitem" onClick={() => choose(cameraInput)} className={ROW}>
              <span className={ICON}><Camera size={18} /></span>
              {labels.camera}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
