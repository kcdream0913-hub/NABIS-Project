"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { findOrCreateThread } from "@/lib/threads";

// "Inquire" opens (or reuses) a 1:1 DM thread with the offering's provider, via
// the same secure get_or_create_direct_thread() RPC the Message buttons use.
export default function InquireButton({ providerUserId }: { providerUserId: string }) {
  const t = useTranslations("offerings");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const threadId = await findOrCreateThread(providerUserId);
        if (threadId) router.push(`/messages/${threadId}`);
        else setLoading(false);
      }}
      className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
    >
      {loading ? t("inquiring") : t("inquire")}
    </button>
  );
}
