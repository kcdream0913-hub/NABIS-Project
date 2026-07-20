"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import Composer from "./composer";
import { Compass, MessagesSquare } from "lucide-react";
import ReportButton from "@/components/ReportButton";

type Post = {
  id: string;
  body: string;
  created_at: string;
  posted_as: string;
  profiles: { name: string | null } | { name: string | null }[] | null;
};
type Channel = { id: string; slug: string; name: string; description: string | null };

type Thread = { id: string; otherName: string };

export default function HomePage() {
  const t = useTranslations("home");
  const supabase = createClient();
  const [mode, setMode] = useState<"feed" | "messages">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    const { data } = await supabase
      .from("posts")
      .select("id, body, created_at, posted_as, profiles:author_id ( name )")
      .order("created_at", { ascending: false })
      .limit(30);
    setPosts(data ?? []);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);

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

      if (mode === "feed") {
        await loadFeed();
      } else {
        const { data: chans } = await supabase
          .from("channels")
          .select("id, slug, name, description")
          .order("name");
        setChannels(chans ?? []);

        if (user) {
          const { data: mine } = await supabase
            .from("direct_thread_participants")
            .select("thread_id")
            .eq("user_id", user.id);
          const threadIds = (mine ?? []).map((r) => r.thread_id);

          if (threadIds.length > 0) {
            const { data: others } = await supabase
              .from("direct_thread_participants")
              .select("thread_id, profiles:user_id ( name )")
              .in("thread_id", threadIds)
              .neq("user_id", user.id);
            setThreads(
              (others ?? []).map((o) => {
                const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
                return { id: o.thread_id, otherName: p?.name ?? "Member" };
              })
            );
          } else {
            setThreads([]);
          }
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
              return (
                <article key={p.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{author?.name ?? t("member")}</p>
                    <ReportButton targetType="post" targetId={p.id} />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{p.body}</p>
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
          <div className="space-y-4">
            {threads.length > 0 && (
              <div>
                <p className="eyebrow mb-2 text-ink-soft">{t("directMessages")}</p>
                <div className="space-y-2">
                  {threads.map((t) => (
                    <Link
                      key={t.id}
                      href={`/messages/${t.id}`}
                      className="flex items-center gap-3 rounded-lg border border-line bg-white p-3 hover:border-pine"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
                        {t.otherName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm font-medium">{t.otherName}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="eyebrow mb-2 text-ink-soft">{t("channels")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
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
        )}
      </div>
    </div>
  );
}

