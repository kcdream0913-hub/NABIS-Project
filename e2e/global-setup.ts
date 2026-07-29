import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadEnvLocal } from "./_env";

// Runs once before the whole Playwright run:
//   1. Load .env.local (non-overriding) so the runner process — and global-teardown,
//      which talks to Supabase directly — has NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
//      locally. In CI these come from the job env and the file is absent (no-op).
//   2. Generate the BL-MSG-05 security fixtures (MZ-pdf, oversize, Devanagari csv,
//      bidi pdf, png). They are gitignored, so CI and a fresh clone build them here
//      instead of pulling binaries from the repo.
export default function globalSetup() {
  loadEnvLocal();
  execFileSync("node", [join(__dirname, "..", "scripts", "gen-e2e-fixtures.mjs")], { stdio: "inherit" });
}
