import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Without this, Next.js scans upward for lockfiles to guess the workspace
  // root. A stray lockfile in a parent folder (e.g. C:\Users\<you>\package-lock.json)
  // makes it guess wrong, which can produce exactly the kind of inconsistent
  // prerender failures seen on this machine — pin it explicitly instead.
  outputFileTracingRoot: path.join(__dirname),
};
export default withNextIntl(nextConfig);
