import type { ReactNode } from "react";
// Route-group-scoped design tokens (ported from the static site). Loaded only on
// marketing routes; the app routes keep globals.css. Theme (.dark) + the pre-paint
// boot script come from the root [locale]/layout, so theme carries over to /login.
import "./theme.css";
import MarketingMotion from "./_components/MarketingMotion";

// No AppShell here — the marketing pages have their own chrome. This group renders
// bare inside the root layout's providers (NextIntl + ThemeProvider).
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bl-marketing" style={{ background: "var(--bg)", overflowX: "clip" }}>
      {children}
      <MarketingMotion />
    </div>
  );
}
