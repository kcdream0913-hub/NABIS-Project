"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { UserMinus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "professional" | "assistant" | "employee";

export default function TeamManager({ businessId }: { businessId: string }) {
  const t = useTranslations("business");
  const supabase = createClient();
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [canPost, setCanPost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .single();
      setIsOwner(data?.owner_user_id === user.id);
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function addMember() {
    setError(null);
    setBusy(true);

    const { data: foundId, error: lookupError } = await supabase.rpc("find_user_id_by_email", {
      lookup_email: email.trim(),
    });

    if (lookupError || !foundId) {
      setError(t("noMemberFound"));
      setBusy(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("business_members").insert({
      business_id: businessId,
      user_id: foundId,
      role,
      status: "active",
      can_post: canPost,
      // Employees are auto-verified under the owner's responsibility — no
      // separate KYC per person (spec §5.3 / D-012).
      verified_via: "business",
      added_by: user?.id,
    });

    if (insertError) {
      setError(
        insertError.message.includes("duplicate")
          ? t("alreadyOnTeam")
          : insertError.message
      );
    } else {
      setEmail("");
      router.refresh();
    }
    setBusy(false);
  }

  if (!isOwner) return null;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line bg-mist p-3">
      <p className="eyebrow text-ink-soft">{t("addMemberTitle")}</p>
      <p className="mt-1 text-xs text-ink-soft">
        {t("addMemberHint")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("memberEmailPlaceholder")}
          className="min-w-[180px] flex-1 rounded-md border border-line px-3 py-1.5 text-sm focus:border-pine"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-line bg-white px-2 py-1.5 text-sm"
        >
          <option value="professional">{t("roleProfessional")}</option>
          <option value="assistant">{t("roleAssistant")}</option>
          <option value="employee">{t("roleEmployee")}</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={canPost}
            onChange={(e) => setCanPost(e.target.checked)}
            className="h-3.5 w-3.5 accent-pine"
          />
          {t("canPostAsBusiness")}
        </label>
        <button
          onClick={addMember}
          disabled={!email.trim() || busy}
          className="flex items-center gap-1 rounded-md bg-pine px-3 py-1.5 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
        >
          <UserPlus size={14} /> {t("add")}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rhodo">{error}</p>}
    </div>
  );
}
