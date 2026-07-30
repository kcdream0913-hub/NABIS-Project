"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import EventEditor from "@/components/EventEditor";
import { readPreferences } from "@/lib/preferences";

// Create route. Any authenticated member can host (RLS = host_id = auth.uid()); no sector
// gate. Businesses the user OWNS become "Host as" options (RLS re-checks ownership).
export default function NewEventPage() {
  const t = useTranslations("events");
  const supabase = createClient();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok">("loading");
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [tz, setTz] = useState("America/New_York");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const [{ data: biz }, { data: profile }] = await Promise.all([
        supabase.from("businesses").select("id, name").eq("owner_user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("preferences").eq("id", user.id).single(),
      ]);
      setBusinesses((biz as { id: string; name: string }[]) ?? []);
      setTz(readPreferences(profile?.preferences).timezone);
      setState("ok");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "loading") return <p className="p-6 text-sm text-ink-soft">{t("loading")}</p>;
  return <EventEditor mode="create" hostBusinesses={businesses} defaultTz={tz} />;
}
