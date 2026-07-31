// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import ne from "@/messages/ne.json";
import PasswordInput from "@/components/PasswordInput";

const MESSAGES: Record<string, typeof en> = { en, ne: ne as typeof en };

describe("PasswordInput show/hide toggle", () => {
  beforeEach(() => cleanup());

  for (const locale of ["en", "ne"]) {
    it(`starts masked and reveals/re-masks on toggle in ${locale}`, () => {
      const { getByLabelText, container } = render(
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
          <PasswordInput value="hunter2" onChange={() => {}} />
        </NextIntlClientProvider>
      );
      const input = container.querySelector("input")!;
      const showLabel = MESSAGES[locale].auth.showPassword as string;
      const hideLabel = MESSAGES[locale].auth.hidePassword as string;

      // Masked by default.
      expect(input.type).toBe("password");
      const toggle = getByLabelText(showLabel);
      expect(toggle.getAttribute("aria-pressed")).toBe("false");

      // Reveal.
      fireEvent.click(toggle);
      expect(input.type).toBe("text");
      const toggleAfterReveal = getByLabelText(hideLabel);
      expect(toggleAfterReveal.getAttribute("aria-pressed")).toBe("true");
      // Same underlying <button>, just re-fetched under its new accessible name.
      expect(toggleAfterReveal).toBe(toggle);

      // Re-mask.
      fireEvent.click(toggleAfterReveal);
      expect(input.type).toBe("password");
      expect(getByLabelText(showLabel).getAttribute("aria-pressed")).toBe("false");
    });
  }

  it("does not clobber a caller-supplied style object, only adds paddingRight", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={MESSAGES.en}>
        <PasswordInput value="" onChange={() => {}} style={{ color: "red" }} />
      </NextIntlClientProvider>
    );
    const input = container.querySelector("input")! as HTMLInputElement;
    expect(input.style.color).toBe("red");
    expect(input.style.paddingRight).toBe("2.5rem");
  });
});
