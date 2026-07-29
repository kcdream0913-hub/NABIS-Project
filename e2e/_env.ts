import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Minimal, dependency-free .env.local loader for the Playwright runner process.
// The app's webServer (`next start`) loads .env.local itself; the runner (and thus
// global-teardown, which talks to Supabase directly) does NOT — so load it here.
//
// NON-OVERRIDING: a key already present in process.env wins. That keeps CI correct
// (secrets come from the job env; there is no .env.local in CI) and lets a local
// shell export override the file. No-op when the file is absent.
export function loadEnvLocal(): void {
  const file = join(__dirname, "..", ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (key in process.env) continue; // never override an already-set var
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
