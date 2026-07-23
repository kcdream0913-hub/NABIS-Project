"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  Home, ContactRound, Hash, CalendarDays, Building2, Settings, LogOut, Map, ShieldAlert,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";

export default function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { setSidebarOpen } = useApp();
  const supabase = createClient();
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Grouped backbone. Community = the daily social surfaces the founding cohort
  // lives in; Tools = utilities + the register-business action. Sector channels
  // stay in Community as the backbone of the network.
  const GROUPS = [
    {
      label: t("groupCommunity"),
      items: [
        { href: "/", label: t("feed"), icon: Home },
        { href: "/members", label: t("directory"), icon: ContactRound },
        { href: "/channels", label: t("channels"), icon: Hash },
        { href: "/events", label: t("events"), icon: CalendarDays },
      ],
    },
    {
      label: t("groupTools"),
      items: [
        { href: "/trip-planner", label: t("tripPlanner"), icon: Map },
        { href: "/business/new", label: t("registerBusiness"), icon: Building2 },
      ],
    },
  ];

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("name, avatar_url").eq("id", user.id).single();
      setName(data?.name ?? user.email ?? "You");
      setAvatarUrl(data?.avatar_url ?? null);

      const { data: admin } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      setIsAdmin(!!admin);
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

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="space-y-0.5">
            <p className="eyebrow px-3 pb-1 text-ink-soft">{g.label}</p>
            {g.items.map((i) => item(i.href, i.label, i.icon))}
          </div>
        ))}
        {isAdmin && (
          <div className="space-y-0.5">
            <p className="eyebrow px-3 pb-1 text-ink-soft">{t("groupAdmin")}</p>
            {item("/admin", t("adminQueue"), ShieldAlert)}
          </div>
        )}
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/profile"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-mist"
        >
          <Avatar name={name} url={avatarUrl} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{name ?? t("loading")}</span>
            <span className="block truncate text-xs text-ink-soft">{t("viewProfile")}</span>
          </span>
          <Settings size={16} className="text-ink-soft" />
        </Link>
        <button
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-mist"
        >
          <LogOut size={16} /> {t("signOut")}
        </button>
      </div>
    </div>
  );
}
