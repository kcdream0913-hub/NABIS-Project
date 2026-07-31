// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import FloatingChatDock from "@/components/FloatingChatDock";

// Only the MINIMIZED popup state is exercised here — the expanded state
// renders the real ThreadConversation (attachments/reactions/realtime), which
// has no dedicated component test anywhere in this codebase today; giving the
// dock its own mock of that surface would test the mock, not the dock. This
// mirrors the existing accepted-gap pattern (e.g. D-067/D-068's admin-E2E
// gaps) rather than inventing new coverage this codebase doesn't otherwise have.
const MESSAGES: Record<string, typeof en> = { en, ne: ne as typeof en };

function Wrap({ locale, children }: { locale: string; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("FloatingChatDock (D-076 popup stack, minimized state)", () => {
  beforeEach(() => cleanup());

  it("renders nothing when there are no open chats", () => {
    const { container } = render(
      <Wrap locale="en">
        <FloatingChatDock chats={[]} onClose={() => {}} onToggleMinimize={() => {}} />
      </Wrap>,
    );
    expect(container.firstChild).toBeNull();
  });

  for (const locale of ["en", "ne"]) {
    it(`shows a minimized chat's name and wires expand/close in ${locale}`, () => {
      const onToggleMinimize = vi.fn();
      const onClose = vi.fn();
      const { getByText, getByLabelText } = render(
        <Wrap locale={locale}>
          <FloatingChatDock
            chats={[{ threadId: "t1", name: "Jane Doe", minimized: true }]}
            onClose={onClose}
            onToggleMinimize={onToggleMinimize}
          />
        </Wrap>,
      );
      expect(getByText("Jane Doe")).toBeTruthy();

      fireEvent.click(getByText("Jane Doe"));
      expect(onToggleMinimize).toHaveBeenCalledWith("t1");

      fireEvent.click(getByLabelText(MESSAGES[locale].messages.close));
      expect(onClose).toHaveBeenCalledWith("t1");
    });
  }

  it("caps display at whatever the parent passes (no internal MAX_OPEN_CHATS re-check) — renders every chat it's given", () => {
    const { getByText } = render(
      <Wrap locale="en">
        <FloatingChatDock
          chats={[
            { threadId: "t1", name: "Jane Doe", minimized: true },
            { threadId: "t2", name: "John Smith", minimized: true },
          ]}
          onClose={() => {}}
          onToggleMinimize={() => {}}
        />
      </Wrap>,
    );
    expect(getByText("Jane Doe")).toBeTruthy();
    expect(getByText("John Smith")).toBeTruthy();
  });
});
