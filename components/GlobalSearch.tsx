"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Result = { type: "person" | "business" | "channel"; id: string; label: string; sub: string };

export default function GlobalSearch() {
  const supabase = createClient();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const [{ data: people }, { data: businesses }, { data: channels }] = await Promise.all([
        supabase.from("profiles").select("id, name, city").ilike("name", `%${term}%`).limit(5),
        supabase.from("businesses").select("id, name, sector").ilike("name", `%${term}%`).limit(5),
        supabase.from("channels").select("id, slug, name").ilike("name", `%${term}%`).limit(5),
      ]);

      setResults([
        ...(people ?? []).map((p) => ({
          type: "person" as const,
          id: p.id,
          label: p.name ?? "Member",
          sub: p.city ?? "",
        })),
        ...(businesses ?? []).map((b) => ({
          type: "business" as const,
          id: b.id,
          label: b.name,
          sub: b.sector ?? "",
        })),
        ...(channels ?? []).map((c) => ({
          type: "channel" as const,
          id: c.slug,
          label: `# ${c.name}`,
          sub: "Channel",
        })),
      ]);
      setOpen(true);
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function go(r: Result) {
    setOpen(false);
    setQ("");
    if (r.type === "person") router.push(`/people/${r.id}`);
    if (r.type === "business") router.push(`/business/${r.id}`);
    if (r.type === "channel") router.push(`/channels/${r.id}`);
  }

  return (
    <div ref={boxRef} className="relative hidden max-w-xs flex-1 sm:block">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search people, businesses, channels"
        className="w-full rounded-md border border-line bg-mist py-1.5 pl-9 pr-3 text-sm placeholder:text-ink-soft focus:border-pine focus:bg-white"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => go(r)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-mist"
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-ink-soft">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
