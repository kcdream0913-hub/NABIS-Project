"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { SettingsSection, SettingsNote } from "./primitives";

export default function DeleteAccountButton() {
  const t = useTranslations("settings.delete");
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true); setError(null);
    // Tightly-scoped SECURITY DEFINER RPC — deletes ONLY auth.uid()'s user;
    // FK cascade removes the profile + owned businesses.
    const { error } = await supabase.rpc("delete_own_account");
    if (error) { setError(error.message); setBusy(false); return; }
    await supabase.auth.signOut();
    router.push("/signup");
    router.refresh();
  }

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <SettingsNote>{t("warning")}</SettingsNote>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent-soft"
      >
        {t("button")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-sm p-5">
            <h3 className="text-[15px] font-semibold text-ink">{t("confirmTitle")}</h3>
            <p className="mt-1 text-[13px] text-ink-soft">{t("confirmBody")}</p>
            <label className="mt-3 block text-[13px] font-medium text-ink" htmlFor="del-confirm">
              {t("typeToConfirm")}
            </label>
            <input
              id="del-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              className="mt-1 w-full rounded-md border border-border-input bg-surface px-3 py-2 text-sm text-ink focus:border-primary"
            />
            {error && <p className="mt-2 text-[13px] text-accent" role="alert">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">
                {t("cancel")}
              </button>
              <button
                onClick={doDelete}
                disabled={busy || confirm !== "DELETE"}
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t("deleting") : t("confirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
