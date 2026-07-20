import { getTranslations } from "next-intl/server";
import { Map } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function TripPlannerPage() {
  const t = await getTranslations("tripPlanner");
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-line bg-white p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-pine-soft text-pine"><Map size={20} /></span>
        <p className="eyebrow mt-4 text-pine">{t("phaseEyebrow")}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("body")}</p>
        <div className="mt-5 space-y-2 rounded-md border border-dashed border-line bg-mist p-4">
          <p className="eyebrow text-ink-soft">{t("previewEyebrow")}</p>
          <div className="grid grid-cols-2 gap-2 opacity-60">
            <input disabled placeholder={t("dates")} className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
            <input disabled placeholder={t("budget")} className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
            <input disabled placeholder={t("groupSize")} className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
            <input disabled placeholder={t("interests")} className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          {t("postHintPrefix")}{" "}
          <Link href="/channels" className="font-medium text-pine hover:text-pine-ink">{t("travelPlans")}</Link>{" "}
          {t("postHintSuffix")}
        </p>
      </div>
    </div>
  );
}
