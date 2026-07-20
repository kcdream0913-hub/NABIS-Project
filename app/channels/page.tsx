import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelsPage() {
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("channels")
    .select("id, slug, name, description")
    .order("name");

  return (
    <div>
      <p className="eyebrow text-ink-soft">Messages</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Channels</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Each channel is a directory of registered businesses in that sector.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(channels ?? []).map((c) => (
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
  );
}
