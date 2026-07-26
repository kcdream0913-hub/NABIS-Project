import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // The Next tsconfig sets jsx:"preserve"; the react plugin transforms JSX/TSX
  // for component tests (Vitest 4's OXC transform otherwise honors preserve).
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Let the real next-intl navigation wrapper run under jsdom by giving
      // next/navigation a resolvable stand-in (Next isn't wired in tests).
      "next/navigation": path.resolve(__dirname, "test/stubs/next-navigation.tsx"),
    },
  },
  test: {
    // Default node env for the pure-logic suites; component tests opt into jsdom
    // per file via a `// @vitest-environment jsdom` docblock.
    environment: "node",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.setup.ts"],
    // Process next-intl so the next/navigation alias reaches its internal import,
    // letting the real navigation wrapper run under jsdom.
    server: { deps: { inline: ["next-intl"] } },
  },
});
