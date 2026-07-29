import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import en from "../en.json";

// CODE -> BUNDLE key check. parity.test.ts proves en.json and ne.json define the
// SAME keys (bundle <-> bundle). This proves the other direction: every literal
// t("key") in the source resolves to a real key in en.json (code -> bundle). That
// is the gap that let bl-i18n-01 ship green — business/[id]/edit called
// t("qServices"|...) under the `businessNew` namespace where those keys don't
// exist (they live under `guided`), so parity was fine but the labels rendered as
// raw key paths + MISSING_MESSAGE at runtime in BOTH locales.
//
// LIMITATION (by construction, documented): this can only see STATIC literal keys
// on a translator whose namespace is a STATIC string. It deliberately skips
//   - t(someVariable)                       — key not knowable statically
//   - t(`prefix.${x}`)                      — interpolated key (any `$` in the arg)
//   - useTranslations(dynamicNamespace)     — namespace not knowable statically
//   - t.rich("k") / t.markup("k") / t.has() — only the bare t("k") call form
// Missed calls are false-NEGATIVES (a real miss slips by), never false-POSITIVES
// (a resolvable key is never flagged). The skipped count is logged, not asserted.
//
// COROLLARY for dead-key REMOVAL (e.g. D-061): this gate only proves a deleted bundle
// key was unreferenced for a namespace where NO dynamic key is built on that translator.
// The moment someone writes t(`prefix.${x}`) on, say, the `tripPlanner` translator, this
// gate stops covering that namespace and any "this key is unused" claim silently weakens —
// re-verify by grep before removing keys from a namespace that has any dynamic t(`...`) call.

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}
const EN_KEYS = new Set(flattenKeys(en));

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "e2e", "coverage", "dist", "build", "__tests__"]);
const Q = "[\"'`]"; // a JS string-quote: double, single, or backtick

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if ((extname(name) === ".ts" || extname(name) === ".tsx") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

// A translator declaration: const t = useTranslations("ns") / getTranslations("ns")
// / getTranslations({ ..., namespace: "ns" }) / useTranslations() (root, "").
const DECL_STR = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:await\\s+)?(?:useTranslations|getTranslations)\\s*\\(\\s*${Q}([^"'\`]*)${Q}\\s*\\)`, "g");
const DECL_OBJ = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:await\\s+)?getTranslations\\s*\\(\\s*\\{[^}]*namespace\\s*:\\s*${Q}([^"'\`]+)${Q}[^}]*\\}\\s*\\)`, "g");
const DECL_NOARG = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?useTranslations\s*\(\s*\)/g;
// Dynamic namespace: useTranslations(identifier) — namespace unknowable, skip its calls.
const DECL_DYN = /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(\s*([A-Za-z_$]\w*)\s*[),]/g;

type Violation = { file: string; call: string; expected: string };

function analyzeFile(path: string, src: string): { violations: Violation[]; skipped: number } {
  // var -> set of static namespaces ("" = root). A var also present in `dynamic`
  // is skipped entirely (conservative — never emit a false positive).
  const ns = new Map<string, Set<string>>();
  const dynamic = new Set<string>();
  const add = (v: string, n: string) => {
    if (!ns.has(v)) ns.set(v, new Set());
    ns.get(v)!.add(n);
  };
  let m: RegExpExecArray | null;
  for (const re of [DECL_STR, DECL_OBJ]) {
    re.lastIndex = 0;
    while ((m = re.exec(src))) add(m[1], m[2]);
  }
  DECL_NOARG.lastIndex = 0;
  while ((m = DECL_NOARG.exec(src))) add(m[1], "");
  DECL_DYN.lastIndex = 0;
  while ((m = DECL_DYN.exec(src))) dynamic.add(m[1]);

  const violations: Violation[] = [];
  let skipped = 0;
  const rel = path.slice(ROOT.length + 1).replace(/\\/g, "/");
  for (const [v, namespaces] of ns) {
    if (dynamic.has(v)) continue;
    // Bare call form v("literalKey") — first arg a quoted string with no `$`
    // (so interpolated template literals are excluded). `.rich`/`.has` won't match
    // because they require a `.` between v and `(`.
    const callRe = new RegExp(`\\b${v}\\s*\\(\\s*${Q}([^"'\`$]+)${Q}`, "g");
    let c: RegExpExecArray | null;
    while ((c = callRe.exec(src))) {
      const key = c[1];
      const resolves = [...namespaces].some((n) => EN_KEYS.has(n ? `${n}.${key}` : key));
      if (!resolves) {
        const shownNs = [...namespaces].map((n) => n || "<root>").join("|");
        violations.push({ file: rel, call: `${v}("${key}")`, expected: `${shownNs}.${key}` });
      }
    }
    // Count interpolated/skippable calls for the diagnostic log only.
    const dynCallRe = new RegExp(`\\b${v}\\s*\\(\\s*\`[^\`]*\\$\\{`, "g");
    while (dynCallRe.exec(src)) skipped++;
  }
  return { violations, skipped };
}

describe("i18n usage: every literal t(\"key\") resolves in en.json (code -> bundle)", () => {
  const files = walk(ROOT).filter((f) => {
    const src = readFileSync(f, "utf8");
    return src.includes("useTranslations") || src.includes("getTranslations");
  });

  it("scans a meaningful number of translator files (guards a broken/empty walk)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("has a substantial en.json (guards against loading a truncated bundle)", () => {
    expect(EN_KEYS.size).toBeGreaterThan(1000);
  });

  it("no source calls a translator with a literal key that is missing from en.json", () => {
    const all: Violation[] = [];
    let skipped = 0;
    for (const f of files) {
      const { violations, skipped: s } = analyzeFile(f, readFileSync(f, "utf8"));
      all.push(...violations);
      skipped += s;
    }
    // Visible in the run so the coverage gap is never mistaken for full coverage.
    // eslint-disable-next-line no-console
    console.log(`i18n usage: scanned ${files.length} translator files, ${skipped} interpolated/dynamic key call(s) skipped (see LIMITATION).`);
    const report = all.map((v) => `${v.file}: ${v.call} -> ${v.expected} (MISSING)`);
    expect(report).toEqual([]);
  });
});
