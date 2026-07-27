"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, Send, Share as ShareIcon, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { logShareSafe, shareDmBody } from "@/lib/feed/share";

// BL-SOCIAL-02 §4.1 — Share. R3: internal only — Web Share API / clipboard / DM.
// Every path logs a post_shares row (append-only counter), and logging never
// blocks the share (logShareSafe).
export default function ShareMenu({
  postId,
  userId,
  permalink,
  quoteText,
  onToast,
  onClose,
}: {
  postId: string;
  userId: string;
  permalink: string;
  quoteText: string | null;
  onToast: (msg: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("social");
  const supabase = createClient();
  const [picking, setPicking] = useState(false);
  const [threads, setThreads] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  function logShare(channel: "dm" | "copy_link" | "native") {
    void logShareSafe(() =>
      supabase.from("post_shares").insert({ post_id: postId, user_id: userId, channel }),
    );
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(permalink);
      onToast(t("linkCopied"));
    } catch {
      onToast(t("copyFailed"));
    }
    logShare("copy_link");
    onClose();
  }

  async function nativeShare() {
    try {
      await navigator.share({ url: permalink });
      logShare("native");
    } catch {
      /* user cancelled — no toast, no error */
    }
    onClose();
  }

  async function openThreadPicker() {
    setPicking(true);
    setLoading(true);
    const { data: mine } = await supabase
      .from("direct_thread_participants")
      .select("thread_id")
      .eq("user_id", userId);
    const ids = (mine ?? []).map((r: { thread_id: string }) => r.thread_id);
    if (ids.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }
    const { data: others } = await supabase
      .from("direct_thread_participants")
      .select("thread_id, profiles:user_id ( name )")
      .in("thread_id", ids)
      .neq("user_id", userId);
    const list = (others ?? []).map((r: { thread_id: string; profiles: { name: string | null } | { name: string | null }[] | null }) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return { id: r.thread_id, name: p?.name ?? t("member") };
    });
    setThreads(list);
    setLoading(false);
  }

  async function sendToThread(threadId: string) {
    const body = shareDmBody(permalink, quoteText, t("sharedAPost"));
    const { error } = await supabase.from("messages").insert({
      thread_id: threadId,
      sender_id: userId,
      body,
      attachments: [],
      reply_to_message_id: null,
    });
    logShare("dm");
    onToast(error ? t("shareSendFailed") : t("shareSent"));
    onClose();
  }

  const Item = ({ icon: Icon, label, onClick }: { icon: typeof Link2; label: string; onClick: () => void }) => (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
    >
      <Icon size={16} className="text-ink-soft" />
      {label}
    </button>
  );

  return (
    <div
      role="menu"
      aria-label={t("shareMenu")}
      className="w-64 rounded-lg border border-border bg-surface p-1 shadow-raised"
    >
      {!picking ? (
        <>
          <Item icon={Send} label={t("shareToDm")} onClick={openThreadPicker} />
          <Item icon={Link2} label={t("copyLink")} onClick={copyLink} />
          {canNativeShare && <Item icon={ShareIcon} label={t("shareVia")} onClick={nativeShare} />}
        </>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-medium text-ink-soft">{t("sendToChat")}</p>
          {loading ? (
            <p className="px-3 py-2 text-sm text-ink-soft">{t("loading")}</p>
          ) : threads.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-soft">
              {t("noThreads")}{" "}
              <Link href="/members" className="font-medium text-primary" onClick={onClose}>
                {t("findMembers")}
              </Link>
            </div>
          ) : (
            threads.map((th) => (
              <button
                key={th.id}
                type="button"
                role="menuitem"
                onClick={() => sendToThread(th.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
              >
                <MessageSquare size={16} className="text-ink-soft" />
                {th.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
