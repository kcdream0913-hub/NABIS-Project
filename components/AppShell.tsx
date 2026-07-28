"use client";

import { useEffect, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ErrorBoundary from "./ErrorBoundary";
import { useApp } from "@/lib/store";

export default function AppShell({ children }: { children: ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useApp();

  // Mobile drawer: Escape closes it (backdrop-click and the in-drawer X button
  // close it too). Listener attaches only while the drawer is open.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen]);

  return (
    <div className="min-h-screen">
      {/* Desktop: a collapsed 68px rail that CLICK-EXPANDS to 248px via the pin
          toggle (no hover-to-open path — BL-DESIGN-03 §2), overlaying content (the
          aside stays 68px wide; the pinned Sidebar root overflows it). z-40 keeps
          the expanded flyout above the main column. Each nav surface is isolated
          in its own error boundary so a fault in the sidebar/topbar degrades to a
          hidden widget + console error rather than blanking the whole app. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[68px] md:block">
        <ErrorBoundary label="sidebar-rail">
          <Sidebar />
        </ErrorBoundary>
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[248px] shadow-xl">
            <ErrorBoundary label="sidebar-drawer">
              <Sidebar expanded />
            </ErrorBoundary>
          </aside>
        </div>
      ) : null}

      <div className="md:pl-[68px]">
        <ErrorBoundary label="topbar">
          <Topbar />
        </ErrorBoundary>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
