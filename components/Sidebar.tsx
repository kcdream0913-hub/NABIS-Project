"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Users2, ContactRound, CalendarDays, MessageSquare, PenSquare,
  Map, Store, Building2, Settings, Lock,
} from "lucide-react";
import { CURRENT_USER, initials } from "@/lib/data";
import { useApp } from "@/lib/store";

const MAIN = [
  { href: "/", label: "Home", icon: Home },
  { href: "/community", label: "Community", icon: Users2 },
  { href: "/members", label: "Members", icon: ContactRound },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/create", label: "Create post", icon: PenSquare },
];

const LATER = [
  { href: "/trip-planner", label: "Trip Planner", icon: Map, tag: "Preview" },
  { href: "/vendor", label: "Vendor Dashboard", icon: Building2, tag: "Phase 3" },
  { href: "/marketplace", label: "Marketplace", icon: Store, tag: "Phase 3" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { setSidebarOpen } = useApp();

  const item = (href: string, label: string, Icon: typeof Home, tag?: string) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setSidebarOpen(false)}
        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active ? "bg-pine-soft text-pine-ink" : "text-ink-soft hover:bg-mist hover:text-ink"
        }`}
      >
        <Icon size={17} strokeWidth={2} className={active ? "text-pine" : "text-ink-soft group-hover:text-ink"} />
        <span className="flex-1">{label}</span>
        {tag ? (
          <span className="flex items-center gap-1 rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold">
            {tag === "Preview" ? null : <Lock size={9} />} {tag}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-4 py-5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-pine text-sm font-bold text-white">B</span>
        <span className="text-[17px] font-semibold tracking-tight">
          Bridge<span className="text-pine">Link</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">{MAIN.map((i) => item(i.href, i.label, i.icon))}</div>
        <div>
          <p className="eyebrow px-3 pb-2 text-ink-soft">Coming next</p>
          <div className="space-y-0.5">{LATER.map((i) => item(i.href, i.label, i.icon, i.tag))}</div>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/profile"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-mist"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
            {initials(CURRENT_USER.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{CURRENT_USER.name}</span>
            <span className="block truncate text-xs text-ink-soft">{CURRENT_USER.role} · Founder</span>
          </span>
          <Settings size={16} className="text-ink-soft" />
        </Link>
      </div>
    </div>
  );
}
