import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import ThemeToggle from "../_components/ThemeToggle";
import MarketingLocaleSwitch from "../_components/MarketingLocaleSwitch";
import RequestInviteForm from "../_components/RequestInviteForm";

// Homepage — faithful port of bridgelink-site-v3/index.html. Inline styles are kept
// (tokenized via CSS variables from theme.css); links are relativized; the five
// photographs use next/image; the theme toggle, locale switch and lead form are
// client islands. All copy renders from the "marketing" i18n namespace (en + the
// approved Nepali dictionary). Served at "/" for logged-out visitors via a
// middleware rewrite. The hero headline animates word-by-word in English; Nepali
// (Devanagari) renders as a single line — never split into animated word spans.
// SEO guard: this page's route file is "/[locale]/home", but the homepage is
// served at "/" (and "/ne") via a middleware rewrite. Without a canonical, a
// crawler that reaches "/home" or "/ne/home" directly would index a duplicate of
// the homepage. The canonical always points at the locale ROOT, so it is
// self-referential when served at "/" and dedupes when hit at "/home".
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = locale === routing.defaultLocale ? "/" : `/${locale}`;
  return {
    title: "BridgeLink — The US–Nepal corridor, in one room",
    description:
      "An invite-only, verified professional network for the operators, investors, and diaspora professionals moving capital, projects, and people between the United States and Nepal.",
    alternates: { canonical },
  };
}

const MONO = "'Geist Mono',monospace";
const GEIST = "'Geist',sans-serif";
const SERIF = "'Newsreader',serif";

// oversized wrapper so a parallax image has headroom to move without revealing edges
function Parallax({ src, alt, sizes, objectPosition }: { src: string; alt: string; sizes: string; objectPosition?: string }) {
  return (
    <div data-parallax="" style={{ position: "absolute", left: 0, top: "-6%", width: "100%", height: "112%" }}>
      <Image src={src} alt={alt} fill sizes={sizes} style={{ objectFit: "cover", objectPosition }} />
    </div>
  );
}

export default async function MarketingHome() {
  const t = await getTranslations("marketing");
  const locale = await getLocale();
  const isNe = locale === "ne";

  return (
    <div style={{ fontFamily: `${GEIST}`, color: "var(--ink)", overflowX: "clip" }}>
      {/* NAV */}
      <nav style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 50, width: "min(1180px, calc(100% - 32px))", boxSizing: "border-box", borderRadius: 18, background: "var(--nav-bg)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid var(--line-10)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "13px 20px", animation: "navDrop 800ms cubic-bezier(0.215,0.61,0.355,1) 200ms both" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--stone)" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--btn)", marginLeft: -4 }} />
          </span>
          <span style={{ font: `500 16px/1 ${GEIST}`, letterSpacing: "-0.01em", color: "var(--ink)" }}>BridgeLink</span>
        </span>
        <span style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "clamp(14px,2vw,28px)", overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <a href="#bridge" style={{ flex: "0 0 auto", whiteSpace: "nowrap", font: `400 14px/1 ${GEIST}`, color: "var(--ink-mid)" }}>{t("nav.theBridge")}</a>
          <a href="#verification" style={{ flex: "0 0 auto", whiteSpace: "nowrap", font: `400 14px/1 ${GEIST}`, color: "var(--ink-mid)" }}>{t("nav.verification")}</a>
          <a href="#roster" style={{ flex: "0 0 auto", whiteSpace: "nowrap", font: `400 14px/1 ${GEIST}`, color: "var(--ink-mid)" }}>{t("nav.whoItsFor")}</a>
          <a href="#corridor" style={{ flex: "0 0 auto", whiteSpace: "nowrap", font: `400 14px/1 ${GEIST}`, color: "var(--ink-mid)" }}>{t("nav.theCorridor")}</a>
          <a href="#login" style={{ flex: "0 0 auto", whiteSpace: "nowrap", font: `400 14px/1 ${GEIST}`, color: "var(--ink-mid)" }}>{t("nav.membership")}</a>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MarketingLocaleSwitch />
          <ThemeToggle />
        </span>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <Image src="/assets/img/hero.jpg" alt="Machapuchare and the Annapurna range above Phewa lake, Pokhara" fill priority sizes="100vw" style={{ objectFit: "cover", animation: "slowZoom 2400ms cubic-bezier(0.215,0.61,0.355,1) both" }} />
          <div data-hero-scrim="" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(24,22,18,0.58) 0%, rgba(24,22,18,0.40) 40%, rgba(24,22,18,0.56) 74%, var(--bg-92) 96%, var(--bg) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(80% 60% at 12% 88%, var(--gold-wash-14), transparent 70%)" }} />
        </div>
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box", padding: "150px clamp(20px,4vw,24px) 70px" }}>
          <div style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "#FBF8F1", animation: "fadeRise 500ms cubic-bezier(0.215,0.61,0.355,1) 200ms both" }}>{t("hero.eyebrow")}</div>
          <h1 style={{ margin: "24px 0 0", maxWidth: 960, font: `400 clamp(40px,5vw,72px)/1.05 ${SERIF}`, letterSpacing: "-0.025em", color: "#FBF8F1", textShadow: "0 1px 40px rgba(24,22,18,0.45)" }}>
            {isNe ? (
              // Devanagari hero: one whole line, single fade — no per-word split.
              <span style={{ display: "inline-block", animation: "fadeRise 750ms cubic-bezier(0.215,0.61,0.355,1) 480ms both" }}>{t("hero.h1")}</span>
            ) : (
              t("hero.h1").split(" ").map((w, i) => (
                <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}>
                  <span style={{ display: "inline-block", animation: `wordUp 750ms cubic-bezier(0.215,0.61,0.355,1) ${480 + i * 70}ms both` }}>{w}</span>
                </span>
              )).reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, " ", el]), [])
            )}
          </h1>
          <p style={{ margin: "26px 0 0", maxWidth: 600, font: `400 clamp(17px,1.4vw,18px)/1.6 ${GEIST}`, color: "#EFE9DC", textWrap: "pretty", animation: "fadeRise 500ms cubic-bezier(0.215,0.61,0.355,1) 1000ms both" }}>{t("hero.lede")}</p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40, animation: "fadeRise 500ms cubic-bezier(0.215,0.61,0.355,1) 1140ms both" }}>
            <Link href="/welcome-tour" data-magnetic="" data-hover="background:var(--btn-hover)" style={{ font: `500 15px/1 ${GEIST}`, color: "#FBF8F1", background: "var(--btn)", border: "none", borderRadius: 12, padding: "17px 30px", cursor: "pointer", transition: "background 180ms", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{t("nav.getStarted")}</Link>
          </div>
        </div>
        <div style={{ position: "relative", maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px) 46px" }}>
          <div style={{ height: 1, background: "linear-gradient(90deg,var(--stone) 0%,#8E8B87 45%,var(--glacier) 100%)", transformOrigin: "left", animation: "railDraw 900ms cubic-bezier(0.215,0.61,0.355,1) 300ms both" }} />
        </div>
      </section>

      {/* CORRIDOR / CULTURE */}
      <section id="corridor" style={{ position: "relative", background: "var(--bg)", padding: "clamp(80px,11vw,150px) 0", scrollMarginTop: 96 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(32px,4vw,64px)", alignItems: "end" }}>
            <div>
              <div data-reveal="" style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{t("culture.eyebrow")}</div>
              <h2 data-reveal="" style={{ margin: "20px 0 0", font: `400 clamp(30px,3.2vw,44px)/1.12 ${SERIF}`, letterSpacing: "-0.02em", color: "var(--ink)", textWrap: "pretty" }}>{t("culture.h2")}</h2>
            </div>
            <p data-reveal="" style={{ margin: 0, maxWidth: 480, font: `400 16px/1.65 ${GEIST}`, color: "var(--ink-mid)", textWrap: "pretty" }}>{t("culture.body")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24, marginTop: "clamp(40px,5vw,72px)" }}>
            <figure data-reveal="" style={{ margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ position: "relative", overflow: "hidden", borderRadius: 28, border: "1px solid var(--line-10)", aspectRatio: "4 / 3" }}>
                <Parallax src="/assets/img/courtyard.jpg" alt="Carved Newari courtyard with prayer flags, Kathmandu Valley" sizes="(max-width: 700px) 100vw, 50vw" />
              </div>
              <figcaption style={{ font: `400 12px/1.4 ${MONO}`, letterSpacing: "0.06em", color: "var(--ink-low)" }}>{t("culture.caption1")}</figcaption>
            </figure>
            <figure data-reveal="" style={{ margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ position: "relative", overflow: "hidden", borderRadius: 28, border: "1px solid var(--line-10)", aspectRatio: "4 / 3" }}>
                <Parallax src="/assets/img/festival.jpg" alt="Girls in ceremonial dress with hands folded in namaste" sizes="(max-width: 700px) 100vw, 50vw" />
              </div>
              <figcaption style={{ font: `400 12px/1.4 ${MONO}`, letterSpacing: "0.06em", color: "var(--ink-low)" }}>{t("culture.caption2")}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* THE BRIDGE */}
      <section id="bridge" style={{ position: "relative", background: "var(--bg-deep)", padding: "clamp(80px,11vw,150px) 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px)" }}>
          <div data-reveal="" style={{ position: "relative", overflow: "hidden", borderRadius: 28, border: "1px solid var(--line-10)" }}>
            <div style={{ position: "relative", overflow: "hidden", minHeight: "clamp(440px,54vw,620px)" }}>
              <Parallax src="/assets/img/meeting.jpg" alt="A formal meeting between Nepali and American counterparts at a wooden table, both flags present" sizes="100vw" objectPosition="50% 38%" />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(20,18,15,0.86) 0%, rgba(20,18,15,0.52) 46%, rgba(20,18,15,0.10) 100%)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", boxSizing: "border-box", padding: "clamp(28px,5vw,72px)", maxWidth: 640 }}>
                <div style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "#E4D9C4" }}>{t("bridge.eyebrow")}</div>
                <h2 style={{ margin: "18px 0 0", font: `400 clamp(30px,3.2vw,44px)/1.12 ${SERIF}`, letterSpacing: "-0.02em", color: "#FBF8F1", textWrap: "pretty" }}>{t("bridge.h2")}</h2>
                <p style={{ margin: "20px 0 0", maxWidth: 460, font: `400 16px/1.65 ${GEIST}`, color: "#EFE9DC", textWrap: "pretty" }}>{t("bridge.body")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VERIFICATION */}
      <section id="verification" style={{ position: "relative", background: "radial-gradient(58% 48% at 90% 3%, var(--glacier-wash-09), transparent 70%), radial-gradient(52% 44% at 3% 97%, var(--gold-wash-11), transparent 70%), var(--bg)", padding: "clamp(80px,11vw,150px) 0", scrollMarginTop: 96 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(32px,5vw,72px)", alignItems: "start" }}>
          <div data-reveal="" style={{ display: "flex", flexDirection: "column", gap: 18, background: "var(--surface)", border: "1px solid var(--line-10)", borderRadius: 24, padding: "clamp(24px,3vw,34px)" }}>
            <div style={{ font: `500 10px/1.4 ${MONO}`, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)" }}>{t("verification.eyebrow")}</div>
            <h2 style={{ margin: 0, maxWidth: 420, font: `400 clamp(27px,2.5vw,34px)/1.18 ${SERIF}`, letterSpacing: "-0.015em", color: "var(--ink)", textWrap: "pretty" }}>{t("verification.h2")}</h2>
            <p style={{ margin: 0, maxWidth: 420, font: `400 15px/1.7 ${GEIST}`, color: "var(--ink-mid)", textWrap: "pretty" }}>{t("verification.body")}</p>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 6, borderTop: "1px solid var(--line-10)" }}>
              {[
                [t("verification.reviewedByLabel"), t("verification.reviewedByValue")],
                [t("verification.decisionLabel"), t("verification.decisionValue")],
                [t("verification.recheckedLabel"), t("verification.recheckedValue")],
                [t("verification.documentsLabel"), t("verification.documentsValue")],
              ].map(([k, v], i, a) => (
                <div key={k} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "8px 16px", padding: "12px 0", borderBottom: i < a.length - 1 ? "1px solid var(--line-10)" : "none" }}>
                  <span style={{ font: `400 10px/1.5 ${MONO}`, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)" }}>{k}</span>
                  <span style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink)", textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div data-reveal="" style={{ display: "flex", flexDirection: "column" }}>
            {[
              ["01", t("verification.check1Title"), t("verification.check1Body"), t("verification.check1Meta"), "var(--ink-low)"],
              ["02", t("verification.check2Title"), t("verification.check2Body"), t("verification.check2Meta"), "var(--ink-low)"],
              ["03", t("verification.check3Title"), t("verification.check3Body"), t("verification.check3Meta"), "var(--glacier)"],
            ].map(([n, title, body, meta, numColor]) => (
              <div key={n} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "clamp(16px,2.4vw,32px)", alignItems: "baseline", padding: "24px 0", borderTop: "1px solid var(--line-12)" }}>
                <span style={{ font: `400 12px/1.4 ${MONO}`, letterSpacing: "0.06em", color: numColor }}>{n}</span>
                <span>
                  <span style={{ display: "block", font: `400 clamp(20px,1.8vw,24px)/1.28 ${SERIF}`, letterSpacing: "-0.01em", color: "var(--ink)" }}>{title}</span>
                  <span style={{ display: "block", marginTop: 10, font: `400 16px/1.7 ${GEIST}`, color: "var(--ink-mid)", textWrap: "pretty" }}>{body}</span>
                  <span style={{ display: "block", marginTop: 14, font: `400 10px/1.5 ${MONO}`, letterSpacing: "0.12em", color: "var(--ink-faint)" }}>{meta}</span>
                </span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-12)", padding: "24px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ font: `500 10px/1.4 ${MONO}`, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)" }}>{t("verification.notLabel")}</span>
              <span style={{ font: `400 16px/1.7 ${GEIST}`, color: "var(--ink-mid)", textWrap: "pretty" }}>{t("verification.notBody")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ROSTER */}
      <section id="roster" style={{ position: "relative", background: "var(--bg-deep)", padding: "clamp(80px,11vw,150px) 0 0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px)" }}>
          <div data-reveal="" style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{t("roster.eyebrow")}</div>
          <h2 data-reveal="" style={{ margin: "20px 0 0", maxWidth: 700, font: `400 clamp(30px,3.2vw,44px)/1.12 ${SERIF}`, letterSpacing: "-0.02em", color: "var(--ink)", textWrap: "pretty" }}>{t("roster.h2")}</h2>
          <div style={{ marginTop: "clamp(36px,4vw,56px)", borderTop: "1px solid var(--line-12)" }}>
            {[
              ["01", t("roster.r1Title"), t("roster.r1Body")],
              ["02", t("roster.r2Title"), t("roster.r2Body")],
              ["03", t("roster.r3Title"), t("roster.r3Body")],
              ["04", t("roster.r4Title"), t("roster.r4Body")],
              ["05", t("roster.r5Title"), t("roster.r5Body")],
              ["06", t("roster.r6Title"), t("roster.r6Body")],
              ["07", t("roster.r7Title"), t("roster.r7Body")],
            ].map(([n, title, body], i, a) => (
              <div key={n} data-reveal="" data-hover="background:var(--line-03)" style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", alignItems: "baseline", padding: "24px 12px", margin: "0 -12px", borderBottom: i < a.length - 1 ? "1px solid var(--line-12)" : "none", borderRadius: 16, transition: "background 180ms" }}>
                <span style={{ flex: "0 0 40px", font: `400 13px/1.4 ${MONO}`, color: "var(--ink-low)" }}>{n}</span>
                <span style={{ flex: "0 1 300px", minWidth: 0, font: `500 clamp(18px,1.6vw,20px)/1.35 ${GEIST}`, color: "var(--ink)" }}>{title}</span>
                <span style={{ flex: "1 1 340px", minWidth: 0, font: `400 16px/1.65 ${GEIST}`, color: "var(--ink-mid)", textWrap: "pretty" }}>{body}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", overflow: "hidden", marginTop: "clamp(56px,7vw,96px)", height: "clamp(340px,44vw,560px)" }}>
          <Parallax src="/assets/img/trek.jpg" alt="Trekking group walking a green ridge above the clouds, Badimalika, far-western Nepal" sizes="100vw" />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-deep-06) 22%, rgba(20,18,15,0.30) 78%, rgba(20,18,15,0.55) 100%)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px)", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <span style={{ font: `400 13px/1.4 ${MONO}`, letterSpacing: "0.04em", color: "rgba(251,248,241,0.9)" }}>{t("roster.bannerLeft")}</span>
            <span style={{ font: `400 13px/1.4 ${MONO}`, letterSpacing: "0.04em", color: "rgba(251,248,241,0.9)" }}>{t("roster.bannerRight")}</span>
          </div>
        </div>
      </section>

      {/* MEMBERSHIP / CTA */}
      <section id="membership" style={{ position: "relative", background: "var(--bg)", padding: "clamp(88px,12vw,160px) 0 clamp(72px,9vw,120px)", overflow: "hidden", scrollMarginTop: 96 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(70% 60% at 50% 120%, var(--glacier-wash-14), transparent 70%), radial-gradient(50% 45% at 8% 6%, var(--gold-wash-12), transparent 70%)" }} />
        <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "0 clamp(20px,4vw,24px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div data-reveal="" style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--gold)" }}>{t("cta.eyebrow")}</div>
          <h2 data-reveal="" style={{ margin: "20px 0 0", maxWidth: 760, font: `400 clamp(30px,3.2vw,44px)/1.12 ${SERIF}`, letterSpacing: "-0.02em", color: "var(--ink)", textWrap: "pretty" }}>{t("cta.h2")}</h2>
          <p data-reveal="" style={{ margin: "20px 0 0", maxWidth: 460, font: `400 16px/1.65 ${GEIST}`, color: "var(--ink-mid)", textWrap: "pretty" }}>{t("cta.body")}</p>

          <div data-reveal="" style={{ width: "100%", maxWidth: 620, marginTop: 38, boxSizing: "border-box", background: "var(--surface)", border: "1px solid var(--line-12)", borderRadius: 24, padding: "clamp(22px,3.4vw,34px)", textAlign: "left", display: "flex", flexDirection: "column", gap: 16 }}>
            <label htmlFor="bl-email" style={{ font: `500 10px/1.4 ${MONO}`, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gold)" }}>{t("cta.emailLabel")}</label>
            <RequestInviteForm />
          </div>

          <div id="login" style={{ scrollMarginTop: 110, display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 32 }}>
            <span style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink-low)" }}>{t("cta.alreadyMember")}</span>
            <Link href="/login" data-hover="background:var(--line-05);borderColor:var(--line-30)" style={{ font: `500 14px/1 ${GEIST}`, color: "var(--ink)", background: "transparent", border: "1px solid var(--line-18)", borderRadius: 12, padding: "12px 20px", transition: "background 180ms,border-color 180ms" }}>{t("nav.logIn")}</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ position: "relative", background: "var(--bg-deep)", borderTop: "1px solid var(--line-10)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "clamp(48px,6vw,72px) clamp(20px,4vw,24px) 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "clamp(32px,4vw,56px)" }}>
          <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 4 }}>{t("footer.insideNetwork")}</span>
            {[t("footer.directory"), t("footer.events"), t("footer.tripPlanner"), t("footer.feed")].map((x) => (
              <a key={x} href="#membership" style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink-mid)" }}>{x}</a>
            ))}
          </nav>
          <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ font: `500 11px/1.4 ${MONO}`, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 4 }}>{t("footer.legal")}</span>
            <Link href="/privacy" style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink-mid)" }}>{t("footer.privacy")}</Link>
            <Link href="/terms" style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink-mid)" }}>{t("footer.terms")}</Link>
            <Link href="/guidelines" style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink-mid)" }}>{t("footer.communityGuidelines")}</Link>
            <Link href="/guidelines#data" style={{ font: `400 14px/1.5 ${GEIST}`, color: "var(--ink-mid)" }}>{t("footer.dataDocuments")}</Link>
          </nav>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex" }}>
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--stone)" }} />
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--btn)", marginLeft: -4 }} />
              </span>
              <span style={{ font: `500 16px/1 ${GEIST}`, letterSpacing: "-0.01em", color: "var(--ink)" }}>BridgeLink</span>
            </span>
            <p style={{ margin: 0, maxWidth: 320, font: `400 14px/1.65 ${GEIST}`, color: "var(--ink-low)", textWrap: "pretty" }}>{t("footer.tagline")}</p>
          </div>
        </div>
        <div style={{ maxWidth: 1180, margin: "0 auto", boxSizing: "border-box", padding: "clamp(36px,4vw,56px) clamp(20px,4vw,24px) 0" }}>
          <div style={{ height: 1, background: "linear-gradient(90deg,var(--stone) 0%,#8E8B87 45%,var(--glacier) 100%)", opacity: 0.6 }} />
          <div style={{ padding: "20px 0 40px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
            <span style={{ font: `400 12px/1.4 ${MONO}`, letterSpacing: "0.06em", color: "var(--ink-faint)" }}>{t("footer.copyright")}</span>
            <span style={{ font: `400 12px/1.4 ${MONO}`, letterSpacing: "0.06em", color: "var(--ink-faint)" }}>{t("footer.everyRequestRead")}</span>
          </div>
        </div>
      </footer>

      {/* grain overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.025, mixBlendMode: "multiply", backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIj48ZmlsdGVyIGlkPSJnIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC45IiBudW1PY3RhdmVzPSIzIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjE2MCIgaGVpZ2h0PSIxNjAiIGZpbHRlcj0idXJsKCNnKSIvPjwvc3ZnPg==')" }} />
    </div>
  );
}
