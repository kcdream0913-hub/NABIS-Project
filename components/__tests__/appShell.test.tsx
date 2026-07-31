// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import { AppProvider } from "@/lib/store";

// Realistic Supabase stub. Crucially it mirrors two real behaviors of the
// @supabase/ssr browser client that caused the production crash: createClient
// returns a SINGLETON, and channel(topic) dedupes by topic and throws if `.on()`
// is called after `.subscribe()`. So two Sidebars sharing a channel NAME (the
// bug) throw here; unique-per-instance names (the fix) do not.
vi.mock("@/lib/supabase/client", () => {
  const chain: any = {
    select: () => chain, eq: () => chain, in: async () => ({ data: [] }),
    order: () => chain, limit: async () => ({ data: [] }),
    single: async () => ({ data: null }), maybeSingle: async () => ({ data: null }),
  };
  const channels = new Map<string, any>();
  const client = {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => chain,
    channel(topic: string) {
      if (channels.has(topic)) return channels.get(topic);
      const ch = {
        topic,
        _subscribed: false,
        on() {
          if (this._subscribed) {
            throw new Error(`cannot add \`postgres_changes\` callbacks for realtime:${topic} after \`subscribe()\`.`);
          }
          return this;
        },
        subscribe() { this._subscribed = true; return this; },
      };
      channels.set(topic, ch);
      return ch;
    },
    removeChannel(ch: any) { if (ch?.topic) channels.delete(ch.topic); },
  };
  return { createClient: () => client }; // singleton, like the real browser client
});

// Real next-intl navigation runs here (next/navigation is aliased to a stub in
// vitest.config.ts) — this exercises the actual @/i18n/navigation wrapper the
// app uses, not a hand-rolled mock.
import AppShell from "@/components/AppShell";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";

const MESSAGES: Record<string, typeof en> = { en, ne: ne as typeof en };

function Shell({ locale, children }: { locale: string; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <AppProvider>{children}</AppProvider>
    </NextIntlClientProvider>
  );
}

describe("app shell renders without a client-side exception", () => {
  beforeEach(() => cleanup());

  for (const locale of ["en", "ne"]) {
    it(`topbar (with LocaleSwitch) mounts in ${locale}`, () => {
      expect(() => render(<Shell locale={locale}><Topbar /></Shell>)).not.toThrow();
    });

    it(`sidebar drawer (expanded) mounts in ${locale}`, () => {
      expect(() => render(<Shell locale={locale}><Sidebar expanded /></Shell>)).not.toThrow();
    });

    it(`Messages nav row hides at xl: (D-077, where the Feed rail covers it) but Feed's own row does not, in ${locale}`, () => {
      // Matched by visible label text, not href — the i18n Link prefixes hrefs
      // with the locale (e.g. /ne/messages), so an exact-href match would be
      // locale-fragile in a way the rendered label text isn't.
      const { getByText } = render(<Shell locale={locale}><Sidebar expanded /></Shell>);
      const messagesLink = getByText(MESSAGES[locale].nav.messages).closest("a");
      const feedLink = getByText(MESSAGES[locale].nav.feed).closest("a");
      expect(messagesLink?.className).toContain("xl:hidden");
      expect(feedLink?.className).not.toContain("xl:hidden");
    });

    it(`two Sidebars (rail + drawer) on one client do not collide on the realtime channel in ${locale}`, () => {
      // The production crash: both Sidebars subscribed the same-named channel on
      // the singleton browser client, so the second mount's `.on()` threw. Mount
      // them together, WITHOUT an error boundary, so a regression re-throws here.
      expect(() =>
        render(
          <Shell locale={locale}>
            <>
              <Sidebar />
              <Sidebar expanded />
            </>
          </Shell>
        )
      ).not.toThrow();
    });

    it(`opening the side menu (hamburger → drawer) does not blank the app in ${locale}`, () => {
      const { getByLabelText, container } = render(
        <Shell locale={locale}>
          <AppShell><div>content</div></AppShell>
        </Shell>
      );
      // Click the hamburger — mounts <Sidebar expanded/> in the drawer, exactly
      // what production does. This is the reported crash trigger.
      const hamburger = getByLabelText(MESSAGES[locale].topbar.openNavigation as string);
      expect(() => act(() => { fireEvent.click(hamburger); })).not.toThrow();
      // The drawer's overlay is present after opening.
      expect(container.querySelector(".fixed.inset-0.z-50")).not.toBeNull();
    });
  }
});

describe("ErrorBoundary contains a fault instead of blanking the app", () => {
  beforeEach(() => cleanup());

  function Boom(): never {
    throw new Error("widget exploded");
  }

  it("renders the fallback and does not rethrow when a child throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    let container: HTMLElement | undefined;
    expect(() => {
      ({ container } = render(
        <div>
          <ErrorBoundary label="test" fallback={<span data-testid="fallback">degraded</span>}>
            <Boom />
          </ErrorBoundary>
          <main>the rest of the app still renders</main>
        </div>
      ));
    }).not.toThrow();
    expect(container!.querySelector('[data-testid="fallback"]')).not.toBeNull();
    expect(container!.textContent).toContain("the rest of the app still renders");
    consoleError.mockRestore();
  });
});
