import { getTranslations } from "next-intl/server";

// NOTE: real clause text comes from project doc BL-LEGAL-05 (not yet available).
// Honest working-draft notice + [ENTITY] / [DATE] placeholders — not lorem.
export default async function PrivacyPolicyPage() {
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto max-w-2xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{t("privacyTitle")}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{t("lastUpdated", { date: "[DATE]" })}</p>
      <div className="card mt-4 space-y-3 p-5 text-sm leading-relaxed text-ink">
        <p className="font-medium">{t("draftNotice")}</p>
        <p className="text-ink-soft">{t("privacyIntro", { entity: "[ENTITY]" })}</p>
      </div>
    </article>
  );
}
