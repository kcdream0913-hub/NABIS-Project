"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useApp } from "@/lib/store";

export default function AppShell({ children }: { children: ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useApp();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-white md:block">
        <Sidebar />
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <Sidebar />
          </aside>
        </div>
      ) : null}

      <div className="md:pl-60">
        <Topbar />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
