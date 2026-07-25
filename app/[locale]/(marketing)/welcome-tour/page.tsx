"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import ThemeToggle from "../_components/ThemeToggle";

const MONO = "'Geist Mono',monospace";
const GEIST = "'Geist',sans-serif";
const SERIF = "'Newsreader',serif";

// Ported from bridgelink-site/onboarding.html — the 3-step pre-signup tour. Named
// /welcome-tour to avoid colliding with the app's post-signup onboarding. Final
// button → /signup; "Skip" → /login (D-033 links: no Google/marketing sign-in).
const STEPS = [
  {
    eyebrow: "Getting started · 1 of 3",
    title: "One room for the whole corridor.",
    lede: "BridgeLink is an invite-only network for people doing real work between the United States and Nepal — operators, investors, diaspora professionals, and tourism leaders.",
    points: [
      "A member directory you can actually trust, organized by sector and side of the corridor.",
      "Events, trips, and working conversations — not a feed of announcements.",
      "Built for people who move capital, projects, and people. Not an audience.",
    ],
  },
  {
    eyebrow: "Getting started · 2 of 3",
    title: "Everyone here has been checked.",
    lede: "Bridge Verified means a person confirmed who you are before you entered the room. That's the entire premise — and it applies to everyone equally.",
    points: [
      "Identity checked — a real person, under their real name.",
      "Entity or role confirmed — the company, fund, or position is what it says.",
      "Sector tagged, publicly — so counterparts know what you actually do.",
    ],
  },
  {
    eyebrow: "Getting started · 3 of 3",
    title: "What happens next.",
    lede: "Sign up if you're ready. If you've been invited, your invitation email is your way in. If not, request access from the homepage — a person reads every request.",
    points: [
      "Create your account with the email your invitation was sent to.",
      "Complete your profile — sector, side of the corridor, what you move.",
      "Verification review usually completes within a few days.",
    ],
  },
];

export default function WelcomeTour() {
  const t = useTranslations("marketing");
  const router = useRouter();
  const [i, setI] = useState(0);
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
