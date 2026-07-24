"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type FontScale = "small" | "normal" | "large";

const THEME_KEY = "bl-theme";
const FONT_KEY = "bl-font";
const FONT_PX: Record<FontScale, string> = { small: "15px", normal: "16px", large: "18px" };

type Ctx = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  resolvedDark: boolean;
  fontScale: FontScale;
  setFontScale: (f: FontScale) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

/** Inline pre-hydration script — applies the stored theme/font before first paint
 *  so there is no light-then-dark flash. Kept tiny and dependency-free. */
export const themeInitScript = `(function(){try{
  var t=localStorage.getItem('${THEME_KEY}')||'system';
  var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark',dark);
  var f=localStorage.getItem('${FONT_KEY}');
  if(f&&${JSON.stringify(FONT_PX)}[f])document.documentElement.style.fontSize=${JSON.stringify(FONT_PX)}[f];
}catch(e){}})();`;

function systemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [fontScale, setFontState] = useState<FontScale>("normal");
  const [resolvedDark, setResolvedDark] = useState(false);

  // hydrate from storage once on mount
  useEffect(() => {
    const t = (localStorage.getItem(THEME_KEY) as ThemeMode) || "system";
    const f = (localStorage.getItem(FONT_KEY) as FontScale) || "normal";
    setThemeState(t);
    setFontState(f);
  }, []);

  // apply theme (and track system changes when in 'system' mode)
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && systemDark());
      document.documentElement.classList.toggle("dark", dark);
      setResolvedDark(dark);
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // apply font scale
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_PX[fontScale];
  }, [fontScale]);

  const setTheme = (t: ThemeMode) => { localStorage.setItem(THEME_KEY, t); setThemeState(t); };
  const setFontScale = (f: FontScale) => { localStorage.setItem(FONT_KEY, f); setFontState(f); };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedDark, fontScale, setFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
