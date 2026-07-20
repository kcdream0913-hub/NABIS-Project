"use client";

import { Bell, Menu, Sparkles } from "lucide-react";
import ViewToggle from "./ViewToggle";
import GlobalSearch from "./GlobalSearch";
import { VIEW_META } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function Topbar() {
  const { view, setSidebarOpen } = useApp();
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 border-b border-line px-4">
        <button
          className="rounded-md p-2 text-ink-soft hover:bg-mist md:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <ViewToggle />

        <GlobalSearch />

        <button className="relative rounded-md p-2 text-ink-soft hover:bg-mist" aria-label="Notifications">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rhodo" />
        </button>

        <button
          disabled
          title="The AI assistant arrives with the Utility phase"
          className="hidden items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-soft opacity-60 sm:flex"
        >
          <Sparkles size={14} /> Assistant
        </button>
      </div>
      {/* Context rail — the active view's color, always visible */}
      <div className={`h-0.5 w-full ${VIEW_META[view].rail}`} aria-hidden />
    </header>
  );
}

