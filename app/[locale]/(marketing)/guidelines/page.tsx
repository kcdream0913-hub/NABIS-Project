import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ThemeToggle from "../_components/ThemeToggle";
import MarketingLocaleSwitch from "../_components/MarketingLocaleSwitch";

// Ported from bridgelink-site-v3/guidelines.html — the Community guidelines +
// Data & documents page, bilingual via the "marketing.guidelines" i18n namespace
// (en + the approved Nepali dictionary). The #data anchor is preserved so the
// footer's "Data & documents" link lands on that section. Full-policy links point
// at the app's own /terms and /privacy (relativized via next-intl Link).
const MONO = "'Geist Mono',monospace";
const GEIST = "'Geist',sans-serif";
const SERIF = "'Newsreader',serif";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing");
  return {
    title: t("guidelines.metaTitle"),
    description:
      "The guidelines every Sangamline member agrees to, and how member data and documents are handled.",
  };
}

// One numbered rule row (top hairline + "0N" marker), matching the static list.
function RuleRow({ n, text }: { n: number; text: string }) {
  return (
    <li style={{ display: "flex", gap: 20, alignItems: "baseline", padding: "22px 0", borderTop: "1px solid var(--line-10)", font: `400 16px/1.65 ${GEIST}`, color: "var(--ink-mid)" }}>
      <span aria-hidden style={{ flex: "0 0 auto", font: `400 13px/1.4 ${MONO}`, letterSpacing: "0.04em", color: "var(--glacier)" }}>
        {String(n).padStart(2, "0")}
      </span>
      <span>{text}</span>
    </li>
  );
}

export default async function GuidelinesPage() {
  const t = await getTranslations("marketing");
  const rules = [t("guidelines.rule1"), t("guidelines.rule2"), t("guidelines.rule3"), t("guidelines.rule4")];
  const data = [t("guidelines.data1"), t("guidelines.data2"), t("guidelines.data3")];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", fontFamily: GEIST, color: "var(--ink)" }}>
      {/* topbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box", padding: "22px clamp(20px,4vw,24px)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
          <span style={{ display: "flex" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--stone)" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--glacier)", marginLeft: -4 }} />
          </span>
          <b style={{ font: `500 16px/1 ${GEIST}`, letterSpacing: "-0.01em" }}>Sangamline</b>
        </Link>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MarketingLocaleSwitch />
          <ThemeToggle />
        </span>
      </div>
      <div style={{ height: 1, background: "linear-gradient(90deg, var(--stone) 0%, #8E8B87 45%, var(--glacier) 100%)", opacity: 0.5, maxWidth: 1180, margin: "0 auto", width: "calc(100% - clamp(40px,8vw,48px))" }} />

      <main style={{ flex: 1, width: "100%", maxWidth: 760, margin: "0 auto", boxSizing: "border-box", padding: "clamp(40px,7vw,80px) clamp(20px,4vw,24px)" }}>
        <div style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{t("guidelines.eyebrow")}</div>
        <h1 style={{ margin: "16px 0 0", font: `400 clamp(30px,3.6vw,44px)/1.12 ${SERIF}`, letterSpacing: "-0.02em", color: "var(--ink)" }}>{t("guidelines.h1")}</h1>
        <p style={{ margin: "16px 0 0", font: `400 16px/1.65 ${GEIST}`, color: "var(--ink-mid)" }}>{t("guidelines.lede")}</p>
        <ol style={{ margin: "36px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
          {rules.map((r, i) => (
            <RuleRow key={i} n={i + 1} text={r} />
          ))}
        </ol>

        <section id="data" style={{ marginTop: "clamp(48px,8vw,80px)", scrollMarginTop: 96 }}>
          <div style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{t("guidelines.dataEyebrow")}</div>
          <h1 style={{ margin: "16px 0 0", font: `400 clamp(30px,3.6vw,44px)/1.12 ${SERIF}`, letterSpacing: "-0.02em", color: "var(--ink)" }}>{t("guidelines.dataH1")}</h1>
          <ol style={{ margin: "36px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
            {data.map((d, i) => (
              <RuleRow key={i} n={i + 1} text={d} />
            ))}
          </ol>
          <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 18, font: `400 15px/1.5 ${GEIST}` }}>
            <span style={{ width: "100%", font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{t("guidelines.fullPolicies")}</span>
            <Link href="/terms" style={{ color: "var(--glacier)" }}>{t("footer.terms")}</Link>
            <Link href="/privacy" style={{ color: "var(--glacier)" }}>{t("footer.privacy")}</Link>
          </div>
        </section>

        <p style={{ marginTop: "clamp(40px,6vw,64px)", font: `400 14px/1.5 ${GEIST}` }}>
          <Link href="/" style={{ color: "var(--ink-low)" }}>{t("guidelines.backHome")}</Link>
        </p>
      </main>
    </div>
  );
}
