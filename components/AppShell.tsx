"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useApp } from "@/lib/store";

export default function AppShell({ children }: { children: ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useApp();
  return (
    <div className="min-h-screen">
      {/* Desktop: collapsed 68px rail that hover-expands to 248px, overlaying
          content (the aside stays 68px wide; the Sidebar root overflows on
          hover). z-40 keeps the expanded flyout above the main column. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[68px] md:block">
        <Sidebar />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[248px] shadow-xl">
            <Sidebar expanded />
          </aside>
        </div>
      ) : null}

      <div className="md:pl-[68px]">
        <Topbar />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
