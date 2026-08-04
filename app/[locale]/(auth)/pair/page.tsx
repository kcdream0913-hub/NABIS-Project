import { getTranslations } from "next-intl/server";
import { Smartphone } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Device pairing — Beta. The mobile app isn't generally available yet; this is
// the chrome-free landing a pairing QR will eventually resolve to.
export default async function PairPage() {
  const t = await getTranslations("auth");
  return (
    <div className="text-center">
      <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">S</span>
      <div className="mt-4 flex items-center justify-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{t("pairTitle")}</h1>
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{t("beta")}</span>
      </div>
      <div className="mt-5 grid place-items-center">
        <div className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-border bg-surface-2 text-ink-soft">
          <Smartphone size={30} strokeWidth={1.5} aria-hidden />
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-soft">{t("pairBody")}</p>
      <p className="mt-6 text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-primary hover:text-primary-pressed">{t("backToLogin")}</Link>
      </p>
    </div>
  );
}
