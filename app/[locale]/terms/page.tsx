import { getTranslations } from "next-intl/server";

// Pilot Terms of Service — text from BL-LEGAL-05 (v0.2-pilot). Placeholders
// ([ENTITY], [LEGAL_EMAIL], [GOVERNING_LAW], [VENUE], [DATE], [PRIVACY_LINK]) are
// intentionally left literal until a real operating entity + counsel review land
// (BL-LEGAL-02 Gate L1). Shipped EN now; NE translation is a pre-onboarding task.
const TOS_VERSION = "v0.2-pilot";
const SECTIONS: { h: string; b: string }[] = [
  { h: "1. Who we are.", b: 'These terms are an agreement between you and [ENTITY] ("BridgeLink," "we," "us"). Contact: [LEGAL_EMAIL].' },
  { h: "2. What BridgeLink is — and isn't.", b: 'BridgeLink is an early, invite-only pilot of a curated community network that helps professionals and businesses in the United States and Nepal discover and connect with each other. We introduce; we don\'t broker. BridgeLink is not a party to any conversation, agreement, service, or transaction between members, makes no guarantee about any member\'s identity, credentials, quality, conduct, or the outcome of any dealing between members, and does not endorse any member. Any arrangement you make with another member is solely between you and them, at your own risk. The pilot is free, experimental, and provided "as is" and "as available"; features may change, break, or be removed, and data may be reset, at any time.' },
  { h: "3. Eligibility.", b: "You must be at least 18 years old. Use the pilot only for yourself, with one account; you're responsible for activity under your account and for keeping your credentials secure." },
  { h: "4. Verification and badges — what they mean.", b: 'During the pilot, a "Verified" label reflects a light community review by BridgeLink (for example, confirming a profile and a basic business signal, or a member reference). It is not an identity check, a background check, a KYC/legal verification, or a credential guarantee, and it is not an endorsement or a recommendation. A "Bridge" label additionally indicates a member set up for cross-border connection; where a regulated profession is involved (e.g., law), we may note a public-registry check, but we do not guarantee its currency. Always exercise your own judgment and do your own due diligence before dealing with anyone. Misrepresenting your verification status, or impersonating another person or business, is prohibited.' },
  { h: "5. No on-platform transactions.", b: "The pilot does not process payments, purchases, bookings, escrow, or fund transfers. Do not send money through BridgeLink; there is no mechanism to do so. Any payment or commercial arrangement between members happens off-platform, at your own risk, and outside these terms." },
  { h: "6. No investment, fundraising, or project funding.", b: "BridgeLink does not solicit, facilitate, broker, or process any investment, securities offering, loan, donation, grant, or project funding, and nothing on the platform is an offer or solicitation of any of these, or investment, legal, tax, or immigration advice. Do not use the pilot to raise or move capital." },
  { h: "7. Your responsibilities across borders.", b: "You are responsible for complying with the laws that apply to you — including business, tax, licensing, export, sanctions, immigration, and foreign-exchange rules in your own country and in any country you do business with. BridgeLink connects people; it does not make cross-border activity lawful for you." },
  { h: "8. Your content.", b: "You keep ownership of what you post. You grant BridgeLink a non-exclusive, worldwide, royalty-free license to host, display, and distribute your content for operating and improving the platform. You represent that you have the rights to what you post and that it doesn't violate anyone's rights." },
  { h: "9. Acceptable use.", b: "No unlawful content or conduct; no harassment, hate, or threats; no fraud, scams, deceptive practices, or misrepresentation (including of verification status); no spam; no posting others' personal information without consent; no scraping, reverse engineering, or automated data extraction. We may remove or label content and suspend or terminate accounts at our discretion during the pilot, with or without notice. We may report unlawful activity to the relevant authorities and cooperate with lawful requests." },
  { h: "10. Member-created spaces.", b: "Some members may create channels or groups. Those spaces and their content belong to the members who run and post in them, not to BridgeLink; we provide the tools and may remove content or spaces that violate these terms. Creating a space may require verification and our approval during the pilot." },
  { h: "11. Feedback.", b: "The pilot's purpose is learning. You grant us a perpetual, royalty-free right to use feedback, suggestions, and usage insights you share, with no obligation to you." },
  { h: "12. Privacy.", b: "Our Pilot Privacy Notice ([PRIVACY_LINK]) explains what we collect and how we use it, including that your information is processed in the United States." },
  { h: "13. Disclaimers; limitation of liability.", b: "To the maximum extent permitted by law: we disclaim all warranties, express or implied; BridgeLink and its people are not liable for any indirect, incidental, special, consequential, or punitive damages, or for the acts, omissions, content, or conduct of any member or third party; and our total liability arising out of the pilot is capped at US $100. Some jurisdictions don't allow certain limitations, so parts of this section may not apply to you." },
  { h: "14. Indemnity.", b: "You will indemnify and hold BridgeLink harmless against third-party claims arising from your content, your dealings with other members, or your breach of these terms." },
  { h: "15. Termination.", b: "You may stop using the pilot anytime and request account deletion. We may end the pilot or your access at any time. Sections 4–8, 11, and 13–17 survive termination." },
  { h: "16. Governing law.", b: "[GOVERNING_LAW — e.g., Delaware, USA] governs; exclusive venue is the courts located in [VENUE]." },
  { h: "17. Changes.", b: "We may update these terms; we'll notify you of material changes and may require renewed acceptance to keep using the pilot." },
];

export default async function TermsPage() {
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto max-w-2xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{t("termsTitle")}</h1>
      <p className="mt-1 text-[13px] text-ink-soft">{TOS_VERSION} · {t("lastUpdated", { date: "[DATE]" })}</p>
      <div className="card mt-4 p-4 text-[13px] leading-relaxed text-ink-soft">{t("pilotBanner")}</div>
      <div className="mt-5 space-y-4 text-sm leading-relaxed">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-semibold text-ink">{s.h}</h2>
            <p className="mt-1 text-ink-soft">{s.b}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
