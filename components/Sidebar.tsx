"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useApp } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { isUnread } from "@/lib/messaging";
import { badgeLabel } from "@/lib/notifications";
import Avatar from "./Avatar";
import NotificationBell from "./NotificationBell";
import { OnlineDot } from "./OnlineDot";
import { NAV_ICON, type NavIconName } from "./icons";

type Item = { href: string; icon: NavIconName; labelKey: string };

// Grouped backbone. Community = the daily social surfaces the founding cohort
// lives in; Tools = utilities + the register-business action. Messages is its
// own destination (chat icon). Sector channels stay in Community as the backbone.
const GROUPS: { groupKey: string; items: Item[] }[] = [
  { groupKey: "groupCommunity", items: [
    { href: "/", icon: "feed", labelKey: "feed" },
    { href: "/messages", icon: "messages", labelKey: "messages" },
    { href: "/members", icon: "members", labelKey: "directory" },
    { href: "/channels", icon: "channels", labelKey: "channels" },
    { href: "/events", icon: "events", labelKey: "events" },
    { href: "/bookmarks", icon: "bookmarks", labelKey: "bookmarks" },
  ]},
  { groupKey: "groupTools", items: [
    { href: "/trip-planner", icon: "trip", labelKey: "tripPlanner" },
    { href: "/business/new", icon: "register", labelKey: "registerBusiness" },
  ]},
];

/**
 * Flyout rail: collapsed to icons (68px). It opens to labels (248px) ONLY on a
 * click/tap of the pin toggle — there is NO hover-to-open path (BL-DESIGN-03 §2),
 * so it behaves identically on touch and pointer. On the mobile drawer `expanded`
 * forces the labels visible (AppShell passes it for the drawer instance only).
 */
export default function Sidebar({ expanded = false }: { expanded?: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { setSidebarOpen } = useApp();
  const supabase = createClient();
  // Unique per Sidebar instance. AppShell mounts TWO Sidebars on mobile (the
  // hidden desktop rail + the drawer) and the browser Supabase client is a
  // singleton, so a shared channel name made the second mount call `.on()` on an
  // already-subscribed channel — which throws synchronously and (without an
  // error boundary) blanked the whole app when the side menu opened.
  const channelId = useId();
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Count of DM threads with something unread (the MESSAGES badge — separate from
  // the ACTIVITY bell, which is backed by the notifications table). Channel unread
  // is deliberately not wired: channels are directory-only today, so there is no
  // channel-content surface to be unread against (the column exists for later).
  const [dmCount, setDmCount] = useState(0);
  // Click-to-pin flyover (A2). Component-local state — each Sidebar instance owns
  // its own pin, so the hidden desktop rail and the mobile drawer never fight over
  // it (the drawer is always `expanded` and never renders the toggle).
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isOpen = expanded || pinned;

  // Labels show only when the rail is open (expanded drawer OR pinned). Opening is
  // click/tap-only via the pin toggle — no hover-to-open path (BL-DESIGN-03 §2).
  // The width and label opacity fade between the two states (CSS transition only,
  // no timers).
  const LABEL = `whitespace-nowrap transition-opacity duration-150 ${isOpen ? "opacity-100" : "opacity-0"}`;
  const rootWidth = isOpen ? "w-[248px]" : "w-[68px]";

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

  // Unread DM dot on the Messages icon. Computed on mount and whenever the route
  // changes (so opening a thread — which stamps last_read_at — clears it on the
  // next navigation), and lit live by a realtime subscription on new messages.
  async function computeUnread() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setDmCount(0);
    const { data: mine } = await supabase
      .from("direct_thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", user.id);
    const threadIds = (mine ?? []).map((r) => r.thread_id);
    if (threadIds.length === 0) return setDmCount(0);
    const readMap: Record<string, string | null> = Object.fromEntries(
      (mine ?? []).map((r) => [r.thread_id, r.last_read_at])
    );
    const { data: msgs } = await supabase
      .from("messages")
      .select("thread_id, sender_id, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });
    const latest: Record<string, { sender_id: string; created_at: string }> = {};
    for (const m of msgs ?? []) if (!latest[m.thread_id]) latest[m.thread_id] = m;
    setDmCount(threadIds.filter((id) => isUnread(latest[id], readMap[id], user.id)).length);
  }

  useEffect(() => {
    computeUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    // RLS scopes realtime to my own threads' messages; a new one from someone
    // else lights the dot immediately.
    const channel = supabase
      .channel(`sidebar-dm-unread-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const row = payload.new as { sender_id: string };
        if (user && row.sender_id !== user.id) computeUnread();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pinned open: close on Escape (returning focus to the toggle) or a pointer
  // press outside the rail. Listeners attach only while pinned.
  useEffect(() => {
    if (!pinned) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPinned(false);
        toggleRef.current?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPinned(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pinned]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const Row = ({ href, icon, label, badge }: { href: string; icon: NavIconName; label: string; badge?: string | null }) => {
    const active = pathname === href;
    const Icon = NAV_ICON[icon];
    return (
      <Link
        href={href}
        onClick={() => setSidebarOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors
          ${active ? "bg-active-soft text-active" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`}
      >
        <span className="relative shrink-0">
          <Icon size={21} strokeWidth={1.9} />
          {badge && (
            <span
              className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-on-accent ring-2 ring-surface"
              aria-label={t("unreadMessages")}
            >
              {badge}
            </span>
          )}
        </span>
        <span className={LABEL}>{label}</span>
      </Link>
    );
  };

  const AdminIcon = NAV_ICON.admin;
  const SettingsIcon = NAV_ICON.settings;

  return (
    <div ref={rootRef} className={`group/nav flex h-full flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out ${rootWidth}`}>
      <Link href="/" aria-label={t("brandHome")} className="flex items-center gap-2.5 rounded-lg px-3.5 py-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">B</span>
        <span className={`text-[17px] font-semibold tracking-tight text-ink ${LABEL}`}>BridgeLink</span>
      </Link>

      {/* Click-to-pin toggle — the touch + keyboard way to expand the rail (hover
          alone is unreachable on touch). Rail only; the drawer is always expanded. */}
      {!expanded && (
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-expanded={pinned}
          aria-label={pinned ? t("collapseMenu") : t("expandMenu")}
          className="mx-2.5 mb-1 flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span className="shrink-0">
            {pinned ? <PanelLeftClose size={21} strokeWidth={1.9} /> : <PanelLeftOpen size={21} strokeWidth={1.9} />}
          </span>
          <span className={LABEL}>{pinned ? t("collapseMenu") : t("expandMenu")}</span>
        </button>
      )}

      {/* Activity bell — mounted OUTSIDE the overflow-y-auto nav below, because its
          panel flies out to the right and nav's overflow would clip it. */}
      <div className="px-2.5 pb-1">
        <NotificationBell labelClass={LABEL} />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4">
        {GROUPS.map((g) => (
          <div key={g.groupKey} className="space-y-0.5">
            <p className={`px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70 ${LABEL}`}>{t(g.groupKey)}</p>
            {g.items.map((it) => <Row key={it.href} href={it.href} icon={it.icon} label={t(it.labelKey)} badge={it.href === "/messages" ? badgeLabel(dmCount) : undefined} />)}
          </div>
        ))}
        {isAdmin && (
          <div className="space-y-0.5">
            <p className={`px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-soft/70 ${LABEL}`}>{t("groupAdmin")}</p>
            <Link href="/admin" onClick={() => setSidebarOpen(false)} aria-current={pathname === "/admin" ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors
                ${pathname === "/admin" ? "bg-active-soft text-active" : "text-ink-soft hover:bg-surface-2 hover:text-ink"}`}>
              <AdminIcon size={21} strokeWidth={1.9} className="shrink-0" />
              <span className={LABEL}>{t("adminQueue")}</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-2.5">
        <div className="flex items-center gap-1">
          <Link href="/profile" onClick={() => setSidebarOpen(false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-surface-2">
            <span className="relative shrink-0">
              <Avatar name={name} url={avatarUrl} size={34} />
              <OnlineDot className="absolute -bottom-0.5 -right-0.5" />
            </span>
            <span className={`min-w-0 flex-1 ${LABEL}`}>
              <span className="block truncate text-sm font-semibold text-ink">{name ?? t("loading")}</span>
              <span className="block text-xs text-online">● {t("online")}</span>
            </span>
          </Link>
          <Link href="/settings" onClick={() => setSidebarOpen(false)} aria-label={t("settings")}
            className={`shrink-0 rounded-lg p-2 text-ink-soft hover:bg-surface-2 hover:text-ink ${LABEL}`}>
            <SettingsIcon size={19} strokeWidth={1.9} />
          </Link>
        </div>
        <button onClick={signOut} className="mt-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2">
          <LogOut size={19} strokeWidth={1.9} className="shrink-0" />
          <span className={LABEL}>{t("signOut")}</span>
        </button>
      </div>
    </div>
  );
}
