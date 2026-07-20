"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import { Compass, MessagesSquare } from "lucide-react";

type Post = {
  id: string;
  body: string;
  created_at: string;
  posted_as: string;
  profiles: { name: string | null } | { name: string | null }[] | null;
};
type Channel = { id: string; slug: string; name: string; description: string | null };

export default function HomePage() {
  const supabase = createClient();
  const [mode, setMode] = useState<"feed" | "messages">("feed");
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (mode === "feed") {
        const { data } = await supabase
          .from("posts")
          .select("id, body, created_at, posted_as, profiles:author_id ( name )")
          .order("created_at", { ascending: false })
          .limit(30);
        setPosts(data ?? []);
      } else {
        const { data } = await supabase
          .from("channels")
          .select("id, slug, name, description")
          .order("name");
        setChannels(data ?? []);
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
          <Compass size={15} /> Feed
        </button>
        <button
          onClick={() => setMode("messages")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium ${
            mode === "messages" ? "bg-pine-soft text-pine-ink" : "text-ink-soft"
          }`}
        >
          <MessagesSquare size={15} /> Messages
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : mode === "feed" ? (
          posts.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="Quiet in the feed so far"
              body="Verified members and businesses can post opportunities and updates here."
              actionHref="/create"
              actionLabel="Create the first post"
            />
          ) : (
            <div className="space-y-3">
              {posts.map((p) => {
                const author = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                return (
                  <article key={p.id} className="rounded-lg border border-line bg-white p-4">
                    <p className="text-sm font-semibold">{author?.name ?? "Member"}</p>
                    <p className="mt-1 text-sm leading-relaxed">{p.body}</p>
                  </article>
                );
              })}
            </div>
          )
        ) : channels.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No channels yet"
            body="Sector channels appear here once seeded."
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
