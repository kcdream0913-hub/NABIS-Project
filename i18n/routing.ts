import { defineRouting } from "next-intl/routing";

// English is unprefixed (existing URLs like "/", "/members" keep working).
// Nepali is prefixed with /ne (e.g. "/ne", "/ne/members").
export const routing = defineRouting({
  locales: ["en", "ne"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];
