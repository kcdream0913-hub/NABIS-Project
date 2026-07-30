"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Ban, Building2, Plus, ShieldAlert, Trash2, UserCheck, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAction } from "@/lib/audit";
import { useSectors } from "@/lib/useSectors";
import type { ProfessionalAccountRow } from "@/app/api/admin/accounts/route";
import {
  type BusinessAccountRow,
  createBusiness,
  deleteBusiness,
  hardDeleteAccount,
  inviteProfessional,
  listBusinesses,
  listProfessionals,
  setAccountBanned,
} from "@/lib/adminAccounts";

// Auth + admin gating: handled upstream by middleware.ts + admin/layout.tsx
// (D-067) — inherited automatically, same as every other /admin/* sub-route.

type ConfirmState =
  | { kind: "delete-professional"; account: ProfessionalAccountRow; ownedBusinessNames: string[] }
  | { kind: "delete-business"; business: BusinessAccountRow }
  | null;

export default function AdminAccounts() {
  const t = useTranslations("adminAccounts");
  const supabase = createClient();
  const sectors = useSectors();

  const [tab, setTab] = useState<"professionals" | "businesses">("professionals");
  const [professionals, setProfessionals] = useState<ProfessionalAccountRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizSector, setBizSector] = useState("");
  const [bizCountry, setBizCountry] = useState("");
  const [bizEmail, setBizEmail] = useState("");
  const [bizOwnerEmail, setBizOwnerEmail] = useState("");

  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [profs, bizs] = await Promise.all([listProfessionals(), listBusinesses(supabase)]);
      setProfessionals(profs);
      setBusinesses(bizs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInvite() {
    setError(null);
    try {
      await inviteProfessional(inviteEmail.trim(), inviteName.trim() || undefined);
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggleBan(account: ProfessionalAccountRow) {
    setBusyId(account.id);
    setError(null);
    try {
      await setAccountBanned(account.id, !account.bannedUntil);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function openDeleteProfessionalConfirm(account: ProfessionalAccountRow) {
    // Show an ACCURATE consequence, not a generic warning: check what this
    // account owns before the admin confirms, since deleting them cascades
    // to every business they own (businesses_owner_user_id_fkey is CASCADE).
    const owned = businesses.filter((b) => b.owner_user_id === account.id);
    setConfirm({ kind: "delete-professional", account, ownedBusinessNames: owned.map((b) => b.name) });
  }

  async function handleConfirmDelete() {
    if (!confirm) return;
    setError(null);
    try {
      if (confirm.kind === "delete-professional") {
        setBusyId(confirm.account.id);
        await hardDeleteAccount(supabase, confirm.account.id);
        await logAction("admin_account_deleted", "user", confirm.account.id, {
          email: confirm.account.email,
          cascaded_business_count: confirm.ownedBusinessNames.length,
        });
      } else {
        setBusyId(confirm.business.id);
        await deleteBusiness(supabase, confirm.business.id);
        await logAction("admin_business_deleted", "business", confirm.business.id, {
          name: confirm.business.name,
        });
      }
      setConfirm(null);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateBusiness() {
    setError(null);
    try {
      // Resolve the owner from the already-loaded, admin-gated professionals list
      // (each row carries its email) rather than the find_user_id_by_email RPC,
      // which is revoked from `authenticated` (F8 oracle). See lib/adminAccounts.ts.
      const target = bizOwnerEmail.trim().toLowerCase();
      const ownerId = professionals.find((p) => (p.email ?? "").toLowerCase() === target)?.id ?? null;
      if (!ownerId) {
        setError(t("ownerNotFound"));
        return;
      }
      await createBusiness(supabase, {
        name: bizName.trim(),
        primary_sector: bizSector,
        country_of_registration: bizCountry.trim(),
        owner_user_id: ownerId,
        business_email: bizEmail.trim(),
      });
      await logAction("admin_business_created", "business", ownerId, { name: bizName.trim() });
      setShowCreateBusiness(false);
      setBizName("");
      setBizSector("");
      setBizCountry("");
      setBizEmail("");
      setBizOwnerEmail("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const inputClass =
    "w-full rounded-md border border-border-input px-2 py-1.5 text-sm focus:border-primary";
  const buttonClass = "rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg";
  const primaryButtonClass =
    "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-pressed";
  const dangerButtonClass =
    "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:opacity-90";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg"
        >
          <ArrowLeft size={13} /> {t("backToDashboard")}
        </Link>
      </div>

      <div className="mt-3 flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("professionals")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "professionals" ? "border-primary text-primary-pressed" : "border-transparent text-ink-soft"
          }`}
        >
          <UserCircle size={14} /> {t("professionalsTab")}
          <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent">
            {professionals.length}
          </span>
        </button>
        <button
          onClick={() => setTab("businesses")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
            tab === "businesses" ? "border-primary text-primary-pressed" : "border-transparent text-ink-soft"
          }`}
        >
          <Building2 size={14} /> {t("businessesTab")}
          <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-on-accent">
            {businesses.length}
          </span>
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-xs text-accent">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {tab === "professionals" && (
            <>
              <div className="flex justify-end">
                <button onClick={() => setShowInvite((v) => !v)} className={primaryButtonClass}>
                  <span className="flex items-center gap-1">
                    <Plus size={13} /> {t("invitePerson")}
                  </span>
                </button>
              </div>

              {showInvite && (
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      type="email"
                      className={inputClass}
                    />
                    <input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                      className={inputClass}
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">{t("inviteHint")}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setShowInvite(false)} className={buttonClass}>
                      {t("cancel")}
                    </button>
                    <button onClick={handleInvite} disabled={!inviteEmail.trim()} className={primaryButtonClass}>
                      {t("sendInvite")}
                    </button>
                  </div>
                </div>
              )}

              {professionals.length === 0 ? (
                <p className="text-sm text-ink-soft">{t("noAccounts")}</p>
              ) : (
                professionals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        {a.name ?? t("unnamed")}
                        {a.isAdmin && (
                          <span className="flex items-center gap-0.5 rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                            <ShieldAlert size={10} /> {t("adminBadge")}
                          </span>
                        )}
                        {a.bannedUntil && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-accent">
                            {t("bannedBadge")}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">{a.email ?? "—"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => handleToggleBan(a)}
                        disabled={busyId === a.id}
                        className={buttonClass}
                        title={t("banHint")}
                      >
                        <span className="flex items-center gap-1">
                          <Ban size={12} /> {a.bannedUntil ? t("unban") : t("ban")}
                        </span>
                      </button>
                      <button
                        onClick={() => openDeleteProfessionalConfirm(a)}
                        disabled={busyId === a.id}
                        className={dangerButtonClass}
                      >
                        <span className="flex items-center gap-1">
                          <Trash2 size={12} /> {t("delete")}
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "businesses" && (
            <>
              <div className="flex justify-end">
                <button onClick={() => setShowCreateBusiness((v) => !v)} className={primaryButtonClass}>
                  <span className="flex items-center gap-1">
                    <Plus size={13} /> {t("newBusiness")}
                  </span>
                </button>
              </div>

              {showCreateBusiness && (
                <div className="rounded-lg border border-border bg-surface p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={bizOwnerEmail}
                      onChange={(e) => setBizOwnerEmail(e.target.value)}
                      placeholder={t("ownerEmailPlaceholder")}
                      type="email"
                      className={inputClass}
                    />
                    <input
                      value={bizName}
                      onChange={(e) => setBizName(e.target.value)}
                      placeholder={t("businessNamePlaceholder")}
                      className={inputClass}
                    />
                    <select
                      value={bizSector}
                      onChange={(e) => setBizSector(e.target.value)}
                      className="rounded-md border border-border-input px-2 py-1.5 text-sm"
                    >
                      <option value="">{t("sectorChoose")}</option>
                      {sectors.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={bizCountry}
                      onChange={(e) => setBizCountry(e.target.value)}
                      placeholder={t("countryPlaceholder")}
                      className={inputClass}
                    />
                    <input
                      value={bizEmail}
                      onChange={(e) => setBizEmail(e.target.value)}
                      placeholder={t("businessEmailPlaceholder")}
                      type="email"
                      className={inputClass}
                    />
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">{t("ownerMustExistHint")}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => setShowCreateBusiness(false)} className={buttonClass}>
                      {t("cancel")}
                    </button>
                    <button
                      onClick={handleCreateBusiness}
                      disabled={!bizName.trim() || !bizSector || !bizOwnerEmail.trim()}
                      className={primaryButtonClass}
                    >
                      {t("createBusiness")}
                    </button>
                  </div>
                </div>
              )}

              {businesses.length === 0 ? (
                <p className="text-sm text-ink-soft">{t("noAccounts")}</p>
              ) : (
                businesses.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{b.name}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {b.verification_status === "verified" ? (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck size={11} /> {t("verified")}
                          </span>
                        ) : (
                          t("unverified")
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirm({ kind: "delete-business", business: b })}
                      disabled={busyId === b.id}
                      className={dangerButtonClass}
                    >
                      <span className="flex items-center gap-1">
                        <Trash2 size={12} /> {t("delete")}
                      </span>
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <ShieldAlert size={15} /> {t("confirmTitle")}
            </p>
            {confirm.kind === "delete-professional" ? (
              <>
                <p className="mt-2 text-sm">
                  {t("confirmDeleteProfessional", { name: confirm.account.name ?? confirm.account.email ?? "" })}
                </p>
                {confirm.ownedBusinessNames.length > 0 && (
                  <p className="mt-2 rounded-md border border-border bg-bg p-2 text-xs text-ink-soft">
                    {t("confirmCascadeWarning", { count: confirm.ownedBusinessNames.length })}{" "}
                    {confirm.ownedBusinessNames.join(", ")}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm">
                {t("confirmDeleteBusiness", { name: confirm.business.name })}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className={buttonClass}>
                {t("cancel")}
              </button>
              <button onClick={handleConfirmDelete} className={dangerButtonClass}>
                {t("confirmDeleteButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
