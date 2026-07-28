import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Building2, UserRound } from "lucide-react";

// Registration fork (BL-NAV-01 fix 6): one question, two equal-weight paths —
// Business (the existing /business/new) or Professional (individual, /professional/new).
// The TOOLS nav row points here instead of straight at /business/new.
export default async function RegisterPage() {
  const t = await getTranslations("register");

  const CARD =
    "flex flex-col items-start gap-2 rounded-xl border border-border-input bg-surface p-5 text-left transition hover:border-primary hover:bg-surface-2";
  const ICON = "grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary";

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("question")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/business/new" className={CARD}>
          <span className={ICON}><Building2 size={20} /></span>
          <span className="text-base font-semibold text-ink">{t("businessTitle")}</span>
          <span className="text-sm text-ink-soft">{t("businessBody")}</span>
        </Link>
        <Link href="/professional/new" className={CARD}>
          <span className={ICON}><UserRound size={20} /></span>
          <span className="text-base font-semibold text-ink">{t("professionalTitle")}</span>
          <span className="text-sm text-ink-soft">{t("professionalBody")}</span>
        </Link>
      </div>
    </div>
  );
}
