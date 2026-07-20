"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, ContactRound, Hash, CalendarDays, Building2, Settings, LogOut, Map,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

const MAIN = [
  { href: "/", label: "Feed / Messages", icon: Home },
  { href: "/members", label: "Directory", icon: ContactRound },
  { href: "/channels", label: "Channels", icon: Hash },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/business/new", label: "Register business", icon: Building2 },
];

const LATER = [{ href: "/trip-planner", label: "Trip Planner", icon: Map, tag: "Phase 2" }];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setSidebarOpen } = useApp();
  const supabase = createClient();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      setName(data?.name ?? user.email ?? "You");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
          <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold">{tag}</span>
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
            {(name ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{name ?? "Loading…"}</span>
            <span className="block truncate text-xs text-ink-soft">View profile</span>
          </span>
          <Settings size={16} className="text-ink-soft" />
        </Link>
        <button
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-mist"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
