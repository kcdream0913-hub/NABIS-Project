"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
        title="Payment processing isn't wired up yet — coming with the Stripe integration (spec §5.13)"
        className="w-full cursor-not-allowed rounded-md bg-gold px-4 py-2 text-sm font-medium text-white opacity-60"
      >
        Pay {priceCurrency} {priceAmount} to contact
      </button>
    );
  }

  return (
    <button
      onClick={message}
      className="w-full rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink"
    >
      Message
    </button>
  );
}
