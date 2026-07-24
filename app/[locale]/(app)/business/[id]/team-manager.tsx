"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "professional" | "assistant" | "employee";

export default function TeamManager({ businessId }: { businessId: string }) {
  const t = useTranslations("business");
  const supabase = createClient();
  const [isOwner, setIsOwner] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [canPost, setCanPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Adding a teammate is ALWAYS an invite by email. We deliberately do not look
  // up whether the address already belongs to a member: find_user_id_by_email is
  // revoked from `authenticated` (F8 email->uid oracle hardening, migration
  // 20260722095956), so any client-side lookup would fail — and, worse, a failed
  // lookup is indistinguishable from "no such member". Redemption resolves the
  // account: redeem_business_invite() binds the invite to the caller's email on
  // signup, so an existing member simply redeems immediately.
  async function createInvite() {
    const target = email.trim();
    if (!target) return;
    setInviting(true);
    setError(null);
    setInviteLink(null);
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
        target,
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
    <div className="mt-3 rounded-lg border border-dashed border-border bg-bg p-3">
      <p className="eyebrow text-ink-soft">{t("addMemberTitle")}</p>
      <p className="mt-1 text-xs text-ink-soft">{t("addMemberHint")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setInviteLink(null);
          }}
          placeholder={t("memberEmailPlaceholder")}
          className="min-w-[180px] flex-1 rounded-md border border-border-input px-3 py-1.5 text-sm focus:border-primary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
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
            className="h-3.5 w-3.5 accent-primary"
          />
          {t("canPostAsBusiness")}
        </label>
        <button
          onClick={createInvite}
          disabled={!email.trim() || inviting}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          <Mail size={14} /> {inviting ? t("inviting") : t("inviteToBridgeLink")}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-accent">{error}</p>}

      {inviteLink && (
        <div className="mt-2 rounded-md border border-border bg-surface p-2.5">
          <p className="text-xs text-ink-soft">{t("inviteCreated")}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-bg px-2 py-1 text-xs">{inviteLink}</code>
            <button
              onClick={copyLink}
              className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-bg"
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
