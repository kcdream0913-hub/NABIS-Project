"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";
import Composer from "./composer";
import { Compass, MessagesSquare, Heart, MessageCircle } from "lucide-react";
import ReportButton from "@/components/ReportButton";
import ThreadConversation from "@/components/ThreadConversation";
import { VIEW_META } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { View } from "@/lib/types";

type FeedProfile = {
  name: string | null;
  avatar_url: string | null;
  verification_status: string | null;
};
type FeedBusiness = {
  name: string | null;
  logo_url: string | null;
  verification_status: string | null;
};
type Post = {
  id: string;
  body: string;
  created_at: string;
  posted_as: string;
  view: string | null;
  profiles: FeedProfile | FeedProfile[] | null;
  businesses: FeedBusiness | FeedBusiness[] | null;
};
type Channel = { id: string; slug: string; name: string; description: string | null };

type Thread = {
  id: string;
  otherName: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: boolean;
};

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const tView = useTranslations("view");
  const format = useFormatter();
  const supabase = createClient();
  const { view } = useApp();
  const [mode, setMode] = useState<"feed" | "messages">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    // View-aware feed (spec §5.6/§5.8): the active country view filters the
    // stream. Posts created before view-stamping (view null) stay visible.
    const { data } = await supabase
      .from("posts")
      .select(
        "id, body, created_at, posted_as, view, profiles:author_id ( name, avatar_url, verification_status ), businesses:business_id ( name, logo_url, verification_status )"
      )
      .or(`view.eq.${view},view.is.null`)
      .order("created_at", { ascending: false })
      .limit(30);
    setPosts((data as Post[] | null) ?? []);
  }

  async function loadMessages() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: chans } = await supabase
      .from("channels")
      .select("id, slug, name, description")
      .order("name");
    setChannels(chans ?? []);
    if (!user) {
      setThreads([]);
      return;
    }
    const { data: mine } = await supabase
      .from("direct_thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", user.id);
    const threadIds = (mine ?? []).map((r) => r.thread_id);
    const readMap: Record<string, string | null> = Object.fromEntries(
      (mine ?? []).map((r) => [r.thread_id, r.last_read_at])
    );
    if (threadIds.length === 0) {
      setThreads([]);
      return;
    }
    const [{ data: others }, { data: lastMsgs }] = await Promise.all([
      supabase
        .from("direct_thread_participants")
        .select("thread_id, profiles:user_id ( name )")
        .in("thread_id", threadIds)
        .neq("user_id", user.id),
      supabase
        .from("messages")
        .select("thread_id, body, sender_id, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false }),
    ]);
    const latest: Record<string, { body: string; sender_id: string; created_at: string }> = {};
    for (const m of lastMsgs ?? []) if (!latest[m.thread_id]) latest[m.thread_id] = m;
    const list: Thread[] = (others ?? []).map((o) => {
      const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
      const lm = latest[o.thread_id];
      const lastRead = readMap[o.thread_id];
      const unread = !!lm && lm.sender_id !== user.id && (!lastRead || lm.created_at > lastRead);
      return {
        id: o.thread_id,
        otherName: p?.name ?? "Member",
        lastBody: lm?.body ?? null,
        lastAt: lm?.created_at ?? null,
        unread,
      };
    });
    list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    setThreads(list);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSelectedThread(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("verification_status")
          .eq("id", user.id)
          .single();
        setIsVerified(profile?.verification_status === "verified");
      }
      if (mode === "feed") await loadFeed();
      else await loadMessages();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, view]);

  return (
    <div>
      {/* The main-screen toggle — Feed (content) vs Messages (channels + DMs) */}
      <div className="flex gap-1 rounded-lg border border-line bg-white p-1">
        <button
          onClick={() => setMode("feed")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            mode === "feed" ? "bg-pine-soft text-pine-ink" : "text-ink-soft"
          }`}
        >
          <Compass size={15} /> {t("feed")}
        </button>
        <button
          onClick={() => setMode("messages")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            mode === "messages" ? "bg-pine-soft text-pine-ink" : "text-ink-soft"
          }`}
        >
          <MessagesSquare size={15} /> {t("messages")}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {mode === "feed" && <Composer isVerified={isVerified} onPosted={loadFeed} />}

        {loading ? (
          <p className="text-sm text-ink-soft">{t("loading")}</p>
        ) : mode === "feed" ? (
          posts.length === 0 ? (
            <EmptyState
              icon={Compass}
              title={t("feedEmptyTitle")}
              body={t("feedEmptyBody")}
            />
          ) : (
            posts.map((p) => {
              const author = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              const business = Array.isArray(p.businesses) ? p.businesses[0] : p.businesses;
              // Business-identity posts (spec §5.6) surface the business;
              // everything else surfaces the human. Identity + verification
              // always travel together (spec §5.4 "badges travel").
              const asBusiness = p.posted_as === "business" && business;
              const displayName = (asBusiness ? business?.name : author?.name) ?? t("member");
              const verified =
                (asBusiness ? business?.verification_status : author?.verification_status) ===
                "verified";
              const chipView = p.view && p.view in VIEW_META ? (p.view as View) : null;
              return (
                <article key={p.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      url={asBusiness ? business?.logo_url : author?.avatar_url}
                      name={displayName}
                      size={38}
                      shape={asBusiness ? "rounded" : "circle"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="truncate text-sm font-semibold">{displayName}</p>
                        <TrustBadge
                          verified={verified}
                          label={asBusiness ? tCommon("verifiedBusiness") : tCommon("verified")}
                        />
                        {chipView && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${VIEW_META[chipView].chip}`}
                          >
                            {tView(`${chipView}Short`)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        <time dateTime={p.created_at}>
                          {format.relativeTime(new Date(p.created_at))}
                        </time>
                      </p>
                    </div>
                    <ReportButton targetType="post" targetId={p.id} />
                  </div>
                  <p className="mt-3 whitespace-pre-line text-body leading-relaxed">{p.body}</p>
                  {/* Reactions-ready scaffold (Batch 2): final footer layout,
                      affordances disabled until reactions are wired. */}
                  <footer className="mt-3 flex items-center gap-1 border-t border-line pt-2">
                    <button
                      type="button"
                      disabled
                      aria-label={t("react")}
                      title={t("react")}
                      data-reactions-scaffold
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-meta text-ink-soft transition-colors ease-standard disabled:opacity-70"
                    >
                      <Heart size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-label={t("comment")}
                      title={t("comment")}
                      data-reactions-scaffold
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-meta text-ink-soft transition-colors ease-standard disabled:opacity-70"
                    >
                      <MessageCircle size={14} aria-hidden />
                    </button>
                  </footer>
                </article>
              );
            })
          )
        ) : channels.length === 0 && threads.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={t("channelsEmptyTitle")}
            body={t("channelsEmptyBody")}
          />
        ) : (
          <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-4">
            {/* Left pane: DM list + channels (full width on mobile until a thread opens) */}
            <div className={`${selectedThread ? "hidden lg:block" : "block"} space-y-4`}>
              {threads.length > 0 && (
                <div>
                  <p className="eyebrow mb-2 text-ink-soft">{t("directMessages")}</p>
                  <div className="space-y-2">
                    {threads.map((th) => (
                      <button
                        key={th.id}
                        onClick={() => {
                          setSelectedThread(th.id);
                          // optimistic: opening clears the unread marker (server marks read too)
                          setThreads((prev) =>
                            prev.map((x) => (x.id === th.id ? { ...x, unread: false } : x))
                          );
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left hover:border-pine ${
                          selectedThread === th.id ? "border-pine" : "border-line"
                        }`}
                      >
                        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
                          {th.otherName.slice(0, 2).toUpperCase()}
                          {th.unread && (
                            <span
                              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rhodo ring-2 ring-white"
                              aria-label={t("unread")}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm ${th.unread ? "font-semibold text-ink" : "font-medium"}`}>
                              {th.otherName}
                            </span>
                            {th.lastAt && (
                              <time dateTime={th.lastAt} className="shrink-0 text-[11px] text-ink-soft">
                                {format.relativeTime(new Date(th.lastAt))}
                              </time>
                            )}
                          </span>
                          {th.lastBody && (
                            <span className={`mt-0.5 block truncate text-xs ${th.unread ? "text-ink" : "text-ink-soft"}`}>
                              {th.lastBody}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="eyebrow mb-2 text-ink-soft">{t("channels")}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {channels.map((c) => (
                    <Link
                      key={c.id}
                      href={`/channels/${c.slug}`}
                      className="rounded-lg border border-line bg-white p-4 hover:border-pine"
                    >
                      <p className="text-sm font-semibold"># {c.name}</p>
                      <p className="mt-1 text-xs text-ink-soft">{c.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Right pane: the selected conversation (or a placeholder on desktop) */}
            <div className={`${selectedThread ? "block" : "hidden lg:block"} mt-4 lg:mt-0`}>
              {selectedThread ? (
                <ThreadConversation threadId={selectedThread} onBack={() => setSelectedThread(null)} />
              ) : (
                <div className="hidden min-h-[300px] place-items-center rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-soft lg:grid">
                  {t("selectConversation")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

