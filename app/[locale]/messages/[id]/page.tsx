"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState("Conversation");
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      // Confirm this user is a participant, then find the other participant's name.
      const { data: participants } = await supabase
        .from("direct_thread_participants")
        .select("user_id, profiles:user_id ( name )")
        .eq("thread_id", id);

      const other = (participants ?? []).find((p) => p.user_id !== user.id);
      const otherProfile = Array.isArray(other?.profiles) ? other?.profiles[0] : other?.profiles;
      if (otherProfile?.name) setOtherName(otherProfile.name);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("thread_id", id)
        .order("created_at");
      setMessages(msgs ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live updates for this thread.
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function send() {
    const text = draft.trim();
    if (!text || !userId) return;
    setDraft("");
    await supabase.from("messages").insert({ thread_id: id, sender_id: userId, body: text });
  }

  if (loading) return <p className="text-sm text-ink-soft">Loading…</p>;

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col rounded-lg border border-line bg-white">
      <header className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">{otherName}</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === userId ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.sender_id === userId ? "bg-pine text-white" : "bg-mist"
              }`}
            >
              {m.body}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <footer className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder={`Message ${otherName.split(" ")[0]}`}
          className="flex-1 rounded-md border border-line bg-mist px-3 py-2 text-sm placeholder:text-ink-soft focus:border-pine focus:bg-white"
        />
        <button
          onClick={send}
          aria-label="Send message"
          className="grid h-9 w-9 place-items-center rounded-md bg-pine text-white hover:bg-pine-ink"
        >
          <Send size={15} />
        </button>
      </footer>
    </div>
  );
}
