import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Generate the BL-MSG-05 security fixtures (MZ-pdf, oversize, Devanagari csv, bidi
// pdf, png) before the suite runs. They are gitignored, so both CI and a fresh clone
// build them here instead of pulling binaries from the repo. Runs once for the whole
// Playwright run.
export default function globalSetup() {
  execFileSync("node", [join(__dirname, "..", "scripts", "gen-e2e-fixtures.mjs")], { stdio: "inherit" });
}
