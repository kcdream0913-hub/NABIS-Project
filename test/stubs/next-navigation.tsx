// Minimal stand-in for next/navigation so the REAL next-intl navigation wrapper
// (@/i18n/navigation) can run under jsdom in component tests. Aliased in
// vitest.config.ts. Provides just the hooks/functions next-intl + the app use.
import { vi } from "vitest";

export const usePathname = () => "/";
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
