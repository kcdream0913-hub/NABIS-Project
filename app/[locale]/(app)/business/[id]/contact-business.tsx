"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateThread } from "@/lib/threads";

export default function ContactBusiness({
  ownerUserId,
  isPaidProvider,
  priceAmount,
  priceCurrency,
}: {
  ownerUserId: string;
  isPaidProvider: boolean;
  priceAmount: number | null;
  priceCurrency: string;
}) {
  const t = useTranslations("business");
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (user && isPaidProvider) {
        const { data } = await supabase
          .from("access_purchases")
          .select("id")
          .eq("buyer_user_id", user.id)
          .eq("provider_id", ownerUserId)
          .eq("status", "paid")
          .maybeSingle();
        setHasPaid(!!data);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function message() {
    const threadId = await findOrCreateThread(ownerUserId);
    if (threadId) router.push(`/messages/${threadId}`);
  }

  if (loading || !userId || userId === ownerUserId) return null;

  if (isPaidProvider && !hasPaid) {
    return (
      <button
        disabled
        title={t("payTooltip")}
        className="w-full cursor-not-allowed rounded-md bg-bridge px-4 py-2 text-sm font-medium text-on-bridge opacity-60"
      >
        {t("payToContact", { currency: priceCurrency, amount: priceAmount ?? "" })}
      </button>
    );
  }

  return (
    <button
      onClick={message}
      className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed"
    >
      {t("message")}
    </button>
  );
}
