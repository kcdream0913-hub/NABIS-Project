"use client";

import { useTranslations } from "next-intl";
import { Menu, Sparkles } from "lucide-react";
import ViewToggle from "./ViewToggle";
import GlobalSearch from "./GlobalSearch";
import LocaleSwitch from "./LocaleSwitch";
import NotificationBell from "./NotificationBell";
import { VIEW_META } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function Topbar() {
  const t = useTranslations("topbar");
  const { view, setSidebarOpen } = useApp();
  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <button
          className="rounded-md p-2 text-ink-soft hover:bg-bg md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label={t("openNavigation")}
        >
          <Menu size={18} />
        </button>

        <ViewToggle />

        {/*
          Right-hand cluster gets ml-auto on this wrapper — not on any one
          child. GlobalSearch hides below `sm`; if ml-auto lived on it (as
          before), the whole cluster collapsed back to the left on mobile
          with nothing pinning Language/Notifications to the right edge.
        */}
        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          {/* Language switch — back in the topbar so the locale is reachable on
              mobile (Settings is behind the hamburger). Path-based /ne + cookie. */}
          <LocaleSwitch />
          {/* Activity bell — the real BL-NOTIF-01 panel. Shown only below md: on
              desktop the sidebar rail carries the bell, so this avoids two bells.
              On mobile the rail is hidden, so this is the one-tap access point. */}
          <div className="md:hidden">
            <NotificationBell variant="topbar" />
          </div>

          <button
            disabled
            title={t("assistantTooltip")}
            className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink-soft opacity-60 sm:flex"
          >
            <Sparkles size={14} /> {t("assistant")}
          </button>
        </div>
      </div>
      {/* Context rail — the active view's color, always visible */}
      <div className={`h-0.5 w-full ${VIEW_META[view].rail}`} aria-hidden />
    </header>
  );
}
