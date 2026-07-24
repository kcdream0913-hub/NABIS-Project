import { getTranslations } from "next-intl/server";

// Pilot Privacy Notice — text from BL-LEGAL-05 (v0.2-pilot). Placeholders
// ([ENTITY], [LEGAL_EMAIL], provider names) stay literal until the entity + counsel
// review land. Shipped EN now; a Nepali translation is required before any
// Nepal-side onboarding (Privacy Act 2075 s.23 "informed" standard).
const PRIVACY_VERSION = "v0.2-pilot";
const SECTIONS: { h: string; b: string }[] = [
  { h: "Who is responsible.", b: "[ENTITY] is responsible for your information. Contact: [LEGAL_EMAIL]." },
  { h: "What we collect.", b: "(a) Account data: name, email, password hash, country of residence, date of birth (used only to confirm you're 18+); (b) Profile and content you choose to post; (c) The light-verification signals you choose to give us (e.g., a website, a public business/social link, or a reference) and our review notes on them; (d) Usage and device data: log data, IP address, pages viewed, approximate location derived from IP; (e) Feedback, including interview notes and — only with your separate consent — recordings; (f) Communications with us. We do not collect government ID documents or biometric data during the pilot. If identity verification launches later, we'll ask for specific separate consent first." },
  { h: "What we use it for.", b: "Operating the pilot; showing the right US / Nepal / Bridge view; light verification, safety, and moderation; improving the product; and communicating with you about the pilot. We do not sell your personal information, and we do not use your content to train third-party AI models." },
  { h: "Where it's processed.", b: "Our servers and providers are in the United States. If you use BridgeLink from Nepal, your information will be transferred to and processed in the United States, where privacy laws differ from Nepal's. We ask for your explicit consent to this transfer at signup." },
  { h: "Who we share it with.", b: "Providers that host and run our infrastructure ([Vercel — hosting], [Supabase — database/storage], [analytics — TBD]) under contracts limiting their use of your data; authorities where legally required; and a successor entity if BridgeLink is reorganized (with notice)." },
  { h: "How long we keep it.", b: "Account data: while your account is active and up to 90 days after a deletion request (backup cycles). Pilot feedback: up to 2 years. We delete or anonymize when no longer needed." },
  { h: "Your choices and rights.", b: "Contact [LEGAL_EMAIL] to access, correct, or delete your account data — we honor this for all pilot users regardless of location. You can withdraw consent by closing your account (this doesn't undo processing already done)." },
  { h: "Age.", b: "BridgeLink is for adults 18+. We don't knowingly collect data from anyone under 18; if we learn we have, we delete it." },
  { h: "Changes.", b: "We'll notify you of material changes and, where required, ask for renewed consent." },
];

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto max-w-2xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{t("privacyTitle")}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{PRIVACY_VERSION} · {t("lastUpdated", { date: "[DATE]" })}</p>
      <div className="card mt-4 p-4 text-[13px] leading-relaxed text-ink-soft">{t("pilotBanner")}</div>
      <div className="mt-5 space-y-4 text-sm leading-relaxed">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-semibold text-ink">{s.h}</h2>
            <p className="mt-1 text-ink-soft">{s.b}</p>
          </section>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-ink-soft">{t("nepaliPending")}</p>
    </article>
  );
}
