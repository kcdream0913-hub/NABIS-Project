"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { UserMinus, UserPlus, Mail, Copy, Check } from "lucide-react";
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

  // "Not found" state offers inviting the person instead of a dead end.
  const [notFoundEmail, setNotFoundEmail] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    setNotFoundEmail(null);
    setInviteLink(null);
    setBusy(true);

    const { data: foundId, error: lookupError } = await supabase.rpc("find_user_id_by_email", {
      lookup_email: email.trim(),
    });

    if (lookupError || !foundId) {
      // Not a dead end anymore — offer to invite this email instead.
      setNotFoundEmail(email.trim());
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

  async function createInvite() {
    if (!notFoundEmail) return;
    setInviting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setInviting(false);
      return;
    }

    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert({
        type: "business_member",
        from_user_id: user.id,
        target: notFoundEmail,
        business_id: businessId,
        role,
        can_post: canPost,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !invite) {
      setError(insertError?.message ?? "Could not create the invite.");
      setInviting(false);
      return;
    }

    setInviteLink(`${window.location.origin}/signup?invite=${invite.id}`);
    setInviting(false);
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOwner) return null;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-line bg-mist p-3">
      <p className="eyebrow text-ink-soft">{t("addMemberTitle")}</p>
      <p className="mt-1 text-xs text-ink-soft">{t("addMemberHint")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setNotFoundEmail(null);
            setInviteLink(null);
          }}
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

      {notFoundEmail && !inviteLink && (
        <div className="mt-2 rounded-md border border-line bg-white p-2.5">
          <p className="text-xs text-ink-soft">{t("noMemberFound")}</p>
          <button
            onClick={createInvite}
            disabled={inviting}
            className="mt-1.5 flex items-center gap-1.5 rounded-md border border-pine px-3 py-1.5 text-xs font-medium text-pine hover:bg-pine-soft disabled:opacity-50"
          >
            <Mail size={13} /> {inviting ? t("inviting") : t("inviteToBridgeLink")}
          </button>
        </div>
      )}

      {inviteLink && (
        <div className="mt-2 rounded-md border border-line bg-white p-2.5">
          <p className="text-xs text-ink-soft">{t("inviteCreated")}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-mist px-2 py-1 text-xs">{inviteLink}</code>
            <button
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium hover:bg-mist"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? t("copied") : t("copyLink")}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">{t("inviteHint")}</p>
        </div>
      )}
    </div>
  );
}
