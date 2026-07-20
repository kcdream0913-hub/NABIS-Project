"use client";

import { useTranslations } from "next-intl";
import { useApp } from "@/lib/store";
import { VIEW_META } from "@/lib/data";
import type { View } from "@/lib/types";

const ORDER: View[] = ["us", "nepal", "bridge"];

export default function ViewToggle() {
  const t = useTranslations("view");
  const { view, setView } = useApp();
  return (
    <div role="tablist" aria-label={t("label")} className="flex items-center gap-1 rounded-lg border border-line bg-white p-1">
      {ORDER.map((v) => {
        const meta = VIEW_META[v];
        const active = v === view;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => setView(v)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
              active ? `${meta.chip}` : "text-ink-soft hover:bg-mist"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${active ? "" : "opacity-30"}`} />
            <span className="hidden sm:inline">{t(v)}</span>
            <span className="sm:hidden">{t(`${v}Short` as "usShort" | "nepalShort" | "bridgeShort")}</span>
          </button>
        );
      })}
    </div>
  );
}
