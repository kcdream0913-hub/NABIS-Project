"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import ThemeToggle from "../_components/ThemeToggle";

const MONO = "'Geist Mono',monospace";
const GEIST = "'Geist',sans-serif";
const SERIF = "'Newsreader',serif";

// Ported from bridgelink-site-v3/onboarding.html — the 3-step pre-signup tour.
// Named /welcome-tour to avoid colliding with the app's post-signup onboarding.
// All copy renders from the "marketing.tour" i18n namespace (en + the approved
// Nepali dictionary). Final button → /signup ("Create your account"); "Skip" →
// /login (D-033 links: no Google/marketing sign-in).

export default function WelcomeTour() {
  const t = useTranslations("marketing");
  const router = useRouter();
  const [i, setI] = useState(0);

  const STEPS = [
    {
      eyebrow: t("tour.s1Eyebrow"),
      title: t("tour.s1Title"),
      lede: t("tour.s1Lede"),
      points: [t("tour.s1P1"), t("tour.s1P2"), t("tour.s1P3")],
    },
    {
      eyebrow: t("tour.s2Eyebrow"),
      title: t("tour.s2Title"),
      lede: t("tour.s2Lede"),
      points: [t("tour.s2P1"), t("tour.s2P2"), t("tour.s2P3")],
    },
    {
      eyebrow: t("tour.s3Eyebrow"),
      title: t("tour.s3Title"),
      lede: t("tour.s3Lede"),
      points: [t("tour.s3P1"), t("tour.s3P2"), t("tour.s3P3")],
    },
  ];
  const last = i === STEPS.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  function next() {
    if (last) { router.push("/signup"); return; }
    setI((n) => Math.min(STEPS.length - 1, n + 1));
  }

  const step = STEPS[i];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", fontFamily: GEIST, color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box", padding: "22px clamp(20px,4vw,24px)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
          <span style={{ display: "flex" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--stone)" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--glacier)", marginLeft: -4 }} />
          </span>
          <b style={{ font: `500 16px/1 ${GEIST}`, letterSpacing: "-0.01em" }}>BridgeLink</b>
        </Link>
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link href="/login" style={{ font: `400 13px/1 ${GEIST}`, color: "var(--ink-faint)" }}>{t("tourSkip")}</Link>
          <ThemeToggle />
        </span>
      </div>
      <div style={{ height: 1, background: "linear-gradient(90deg, var(--stone) 0%, #8E8B87 45%, var(--glacier) 100%)", opacity: 0.5, maxWidth: 1180, margin: "0 auto", width: "calc(100% - clamp(40px,8vw,48px))" }} />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(28px,5vw,56px) clamp(20px,4vw,24px)" }}>
        <div role="group" aria-label="Getting started" style={{ width: "100%", maxWidth: 640, background: "var(--surface)", border: "1px solid var(--line-12)", borderRadius: 24, padding: "clamp(26px,4.5vw,44px)", boxSizing: "border-box", animation: "fadeRise 500ms cubic-bezier(0.215,0.61,0.355,1) both" }}>
          <div key={i} style={{ animation: "fadeRise 420ms cubic-bezier(0.215,0.61,0.355,1) both" }}>
            <div style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{step.eyebrow}</div>
            <h1 style={{ margin: "16px 0 0", font: `400 clamp(26px,3vw,36px)/1.15 ${SERIF}`, letterSpacing: "-0.02em", color: "var(--ink)" }}>{step.title}</h1>
            <p style={{ margin: "16px 0 0", font: `400 16px/1.65 ${GEIST}`, color: "var(--ink-mid)" }}>{step.lede}</p>
            <ul style={{ margin: "22px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
              {step.points.map((p) => (
                <li key={p} style={{ display: "flex", gap: 12, alignItems: "baseline", font: `400 15px/1.6 ${GEIST}`, color: "var(--ink-mid)" }}>
                  <span aria-hidden style={{ color: "var(--glacier)", font: `400 13px/1.6 ${MONO}` }}>—</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 32 }}>
            <button type="button" onClick={() => setI((n) => Math.max(0, n - 1))} style={{ font: `400 14px/1 ${GEIST}`, color: "var(--ink-low)", background: "none", border: "none", cursor: "pointer", padding: "12px 4px", visibility: i === 0 ? "hidden" : "visible" }}>{t("tourBack")}</button>
            <div aria-hidden style={{ display: "flex", gap: 8 }}>
              {STEPS.map((_, k) => (
                <span key={k} style={{ width: 7, height: 7, borderRadius: "50%", background: k === i ? "var(--glacier)" : "var(--line-18)", transform: k === i ? "scale(1.25)" : "none", transition: "background 200ms, transform 200ms" }} />
              ))}
            </div>
            <button type="button" onClick={next} data-magnetic="" data-hover="background:var(--btn-hover)" style={{ font: `500 15px/1 ${GEIST}`, color: "#FBF8F1", background: "var(--btn)", border: "none", borderRadius: 12, padding: "15px 24px", cursor: "pointer", transition: "background 180ms", display: "inline-flex", alignItems: "center", gap: 8 }}>{last ? t("tourFinal") : t("tourContinue")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
