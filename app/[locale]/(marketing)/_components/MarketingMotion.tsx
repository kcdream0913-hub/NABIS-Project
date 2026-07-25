"use client";

import { useEffect } from "react";

// Ports bridgelink-site/js/site.js motion into a client component mounted on the
// marketing routes only: Lenis smooth scroll, GSAP ScrollTrigger reveals, hero/
// image parallax, magnetic buttons, and the data-hover / data-focus inline-style
// state handling. prefers-reduced-motion → everything static. gsap/lenis are
// dynamically imported so they never touch the server render.
export default function MarketingMotion() {
  useEffect(() => {
    // data-hover / data-focus: apply inline style pairs on interaction, restore on exit.
    function parsePairs(s: string): Record<string, string> {
      const out: Record<string, string> = {};
      s.split(";").forEach((p) => {
        const i = p.indexOf(":");
        if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
      });
      return out;
    }
    const cleanups: (() => void)[] = [];
    function bindState(attr: string, onEv: string, offEv: string) {
      document.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
        const pairs = parsePairs(el.getAttribute(attr) || "");
        const prev: Record<string, string> = {};
        const on = () => { for (const k in pairs) { prev[k] = el.style.getPropertyValue(k) || (el.style as any)[k]; (el.style as any)[k] = pairs[k]; } };
        const off = () => { for (const k in pairs) (el.style as any)[k] = prev[k] || ""; };
        el.addEventListener(onEv, on);
        el.addEventListener(offEv, off);
        cleanups.push(() => { el.removeEventListener(onEv, on); el.removeEventListener(offEv, off); });
      });
    }
    bindState("data-hover", "mouseenter", "mouseleave");
    bindState("data-focus", "focus", "blur");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return () => cleanups.forEach((c) => c());

    let disposed = false;
    let lenisInstance: { raf: (t: number) => void; on: (e: string, cb: () => void) => void; destroy: () => void } | null = null;
    let raf = 0;
    const triggers: Array<{ kill: () => void; scrollTrigger?: { kill: () => void } }> = [];

    (async () => {
      const [{ default: Lenis }, gsapMod, stMod] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (disposed) return;
      const gsap = gsapMod.default ?? gsapMod;
      const ScrollTrigger = (stMod as any).ScrollTrigger ?? (stMod as any).default;
      gsap.registerPlugin(ScrollTrigger);

      try {
        lenisInstance = new Lenis({ lerp: 0.09, smoothWheel: true }) as any;
        const loop = (t: number) => { lenisInstance!.raf(t); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        lenisInstance!.on("scroll", ScrollTrigger.update);
        ScrollTrigger.refresh();
      } catch {
        document.documentElement.style.scrollBehavior = "smooth";
      }

      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (el.dataset.revealed === "1") return;
        const below = el.getBoundingClientRect().top > innerHeight * 0.88;
        el.dataset.revealed = "1";
        if (!below) return;
        triggers.push(gsap.from(el, {
          opacity: 0, y: 18, duration: 0.85, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        }));
      });

      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((img) => {
        triggers.push(gsap.fromTo(img, { yPercent: -3 }, {
          yPercent: 3, ease: "none",
          scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
        }));
      });

      if (window.matchMedia("(pointer: fine)").matches) {
        const ease = "cubic-bezier(0.215,0.61,0.355,1)";
        document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((btn) => {
          const move = (e: MouseEvent) => {
            const r = btn.getBoundingClientRect();
            const dx = (e.clientX - r.left - r.width / 2) / r.width;
            const dy = (e.clientY - r.top - r.height / 2) / r.height;
            btn.style.transition = "background 180ms";
            btn.style.transform = `translate(${(dx * 5).toFixed(1)}px,${(dy * 4).toFixed(1)}px)`;
          };
          const leave = () => {
            btn.style.transition = `background 180ms, transform 400ms ${ease}`;
            btn.style.transform = "translate(0,0)";
          };
          btn.addEventListener("mousemove", move);
          btn.addEventListener("mouseleave", leave);
          cleanups.push(() => { btn.removeEventListener("mousemove", move); btn.removeEventListener("mouseleave", leave); });
        });
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (lenisInstance) lenisInstance.destroy();
      triggers.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
      cleanups.forEach((c) => c());
    };
  }, []);

  return null;
}
