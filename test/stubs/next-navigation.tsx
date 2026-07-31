// Minimal stand-in for next/navigation so the REAL next-intl navigation wrapper
// (@/i18n/navigation) can run under jsdom in component tests. Aliased in
// vitest.config.ts. Provides just the hooks/functions next-intl + the app use.
import { vi } from "vitest";

// D-078: mutable so a test can simulate being on a non-Feed route (the exact
// case D-077's original, unpathname-gated `xl:hidden` got wrong). Defaults to
// "/" so every existing test that doesn't touch this keeps its prior behavior
// unchanged. Tests that call __setTestPathname MUST reset it (afterEach or a
// try/finally) so they don't leak state into later tests.
let _pathname = "/";
export const usePathname = () => _pathname;
export function __setTestPathname(path: string) {
  _pathname = path;
}
export function __resetTestPathname() {
  _pathname = "/";
}
export const useRouter = () => ({
  replace: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
});
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({ locale: "en" });
export const useSelectedLayoutSegment = () => null;
export const redirect = vi.fn();
export const permanentRedirect = vi.fn();
export const notFound = vi.fn();
