// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";

// A real Supabase query is a chainable, thenable builder — awaiting at ANY
// point in the chain (not just after the last method) resolves it. This
// stub models that precisely (unlike a mock that only makes the final call
// async) because these tests assert on rendered CONTENT, not just "didn't
// throw" — FeedMessenger's `mine` query terminates at `.eq()`, not `.in()`.
function thenable(data: unknown) {
  const obj: any = {
    select: () => obj,
    eq: () => obj,
    neq: () => obj,
    in: () => obj,
    order: () => obj,
    then(resolve: (v: { data: unknown }) => void) {
      resolve({ data });
    },
  };
  return obj;
}

// Realtime channel stub, same shape (and same reason) as appShell.test.tsx's:
// FeedMessenger opens its OWN channel (`feed-messenger-${useId()}`) exactly
// like the Sidebar's unread dot does, so this guards the identical
// "shared channel name between two mounted instances throws on the second
// `.on()`" class of bug (D-051-adjacent) rather than re-deriving a weaker one.
function makeSupabaseStub(opts: {
  userId?: string | null;
  mineRows?: { thread_id: string; last_read_at: string | null }[];
  othersRows?: { thread_id: string; profiles: { name: string | null } }[];
  lastMsgRows?: { thread_id: string; body: string | null; sender_id: string; created_at: string; deleted_at: string | null; attachments: null }[];
}) {
  const userId = opts.userId ?? null;
  let dtpCallCount = 0;
  const channels = new Map<string, any>();
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from(table: string) {
      if (table === "direct_thread_participants") {
        dtpCallCount += 1;
        return thenable(dtpCallCount === 1 ? (opts.mineRows ?? []) : (opts.othersRows ?? []));
      }
      return thenable(opts.lastMsgRows ?? []);
    },
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
        subscribe() {
          this._subscribed = true;
          return this;
        },
      };
      channels.set(topic, ch);
      return ch;
    },
    removeChannel(ch: any) {
      if (ch?.topic) channels.delete(ch.topic);
    },
  };
}

const MESSAGES: Record<string, typeof en> = { en, ne: ne as typeof en };

function Wrap({ locale, children }: { locale: string; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("FeedMessenger (D-076 Feed rail)", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
  });

  for (const locale of ["en", "ne"]) {
    it(`renders the logged-out empty state without throwing in ${locale}`, async () => {
      vi.doMock("@/lib/supabase/client", () => ({ createClient: () => makeSupabaseStub({ userId: null }) }));
      const { default: Mounted } = await import("@/components/FeedMessenger");
      const { findByText } = render(
        <Wrap locale={locale}>
          <Mounted onOpenThread={() => {}} />
        </Wrap>,
      );
      expect(await findByText(MESSAGES[locale].messages.emptyTitle)).toBeTruthy();
    });

    it(`two FeedMessenger instances on one client do not collide on the realtime channel in ${locale}`, async () => {
      // Mirrors appShell.test.tsx's "two Sidebars" regression guard: if the
      // channel name were shared instead of per-instance (useId()-scoped), the
      // second mount's own subscribe would collide with the first's.
      vi.doMock("@/lib/supabase/client", () => ({ createClient: () => makeSupabaseStub({ userId: null }) }));
      const { default: Mounted } = await import("@/components/FeedMessenger");
      expect(() =>
        render(
          <Wrap locale={locale}>
            <>
              <Mounted onOpenThread={() => {}} />
              <Mounted onOpenThread={() => {}} />
            </>
          </Wrap>,
        ),
      ).not.toThrow();
    });
  }

  it("renders a thread with its preview and unread dot, then clicking it calls onOpenThread and clears the dot", async () => {
    vi.doMock("@/lib/supabase/client", () => ({
      createClient: () =>
        makeSupabaseStub({
          userId: "me",
          mineRows: [{ thread_id: "t1", last_read_at: null }],
          othersRows: [{ thread_id: "t1", profiles: { name: "Jane Doe" } }],
          lastMsgRows: [
            { thread_id: "t1", body: "hey there", sender_id: "them", created_at: "2026-07-31T00:00:00Z", deleted_at: null, attachments: null },
          ],
        }),
    }));
    const { default: Mounted } = await import("@/components/FeedMessenger");
    const onOpenThread = vi.fn();
    const { findByText, getByText, getByLabelText } = render(
      <Wrap locale="en">
        <Mounted onOpenThread={onOpenThread} />
      </Wrap>,
    );

    await findByText("Jane Doe");
    expect(getByText("hey there")).toBeTruthy();
    expect(getByLabelText("Unread")).toBeTruthy(); // never-read thread with a foreign message

    fireEvent.click(getByText("Jane Doe"));
    await waitFor(() => expect(onOpenThread).toHaveBeenCalledWith("t1", "Jane Doe"));
    // Optimistic: the dot clears immediately on click, without waiting on a refetch.
    expect(() => getByLabelText("Unread")).toThrow();
  });
});
