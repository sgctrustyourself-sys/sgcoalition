#!/usr/bin/env node
/**
 * scripts/audit-urgency-chrome.ts
 *
 * Automated enforcement of the "Peaceful Space" framework documented in
 * docs/peaceful-space.md. Scans pages/ and components/ for the closed
 * set of urgency-chrome patterns the wedge retired and reports any drift.
 *
 * Run locally:  `npm run audit:chrome`  (alias for `tsx scripts/audit-urgency-chrome.ts`)
 * Run in CI:    same; non-zero exit on violation. Add the npm script to
 *               your pre-merge / pre-build checks so the framework is
 *               enforced at PR-review time rather than only at audit time.
 *
 * Rule design philosophy (lesson learned from v1):
 *   Pattern-banning beats color-banning. Single-class regexes like
 *   "anything in text-green-400" generate hundreds of false positives
 *   because green also names success-checkmark states, red also names
 *   form-error states, and yellow also names star ratings + warnings.
 *   The framework cares about COMPOSITE celebration patterns — the
 *   specific combinations that manufacture synthetic purchase pressure
 *   (Sparkles icon + carnival color, ALL-CAPS shout copy, removed-
 *   component imports, removed-utility references). The rules here
 *   match those exact composites; semantic primitives are NOT enforced
 *   as standalone color patterns because they overlap with valid UI
 *   (status indicators, error states, semantic conventions).
 *
 *   Note on dropped v1 patterns:
 *     - URG-OPAQUE-CELEBRATION tried to catch `bg-X-100/200 text-X-700+`
 *       celebration boxes, but `bg-green-100 text-green-800` is also the
 *       canonical "Paid" / "Refunded" / "Active" status pill — semantic
 *       indicators, not urgency chrome. Detecting celebration tone vs.
 *       status tone requires parsing neighbouring copy, which is outside
 *       this audit's mandate.
 *     - URG-PULSE-BADGE tried to catch bright-bg + animate-pulse pairs,
 *       but the codebase has many legitimate live indicators (online
 *       dots, real-time event pulses, status rings) that ALSO use
 *       bright-color animate-pulse with no celebration framing.
 *       Painting the line between urgency badge and live indicator is
 *       better done in review than by regex. The deprecated-import
 *       rule below catches the specific rebirths that matter.
 *
 * Adding an intentional Kept Pattern:
 *   1. Add `{ file: '...', reason: '...', scenario?: '...' }` to the
 *      rule's `allowlist`.
 *   2. Document the keep in docs/peaceful-space.md "Kept Patterns".
 *   Both are required.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const DOCS_REF = 'docs/peaceful-space.md';

interface AllowlistEntry {
  /** Substring of the file's relative path from project root. Forward-slash separators. */
  file: string;
  /** Human-readable reason for the keep — emitted at violation time. */
  reason: string;
  /** Substring the matched line MUST contain for the keep to apply. */
  scenario?: string;
}

interface Rule {
  /** Stable identifier — used in CI output for grep-able failures. */
  id: string;
  /** One-sentence description — emitted at violation time. */
  description: string;
  /** Regex matched against each line of each file. */
  pattern: RegExp;
  /** Explicit list of legitimate exceptions. Empty array = nothing exempted by file. */
  allowlist: AllowlistEntry[];
}

interface Violation {
  ruleId: string;
  description: string;
  file: string;
  line: number;
  matchedText: string;
}

// ============================================================
// RULES — every rule carries docs/peaceful-space.md as source of truth.
// ============================================================

const RULES: Rule[] = [
  /**
   * Rule 1: Sparkles paired with carnival color.
   * The wedge specifically removed `<Sparkles ... text-green-400>` next to
   * "Save $X" and similar. Inline-only (no `s` flag) so multi-line JSX
   * props can't slip through. CustomInquiryManager's default-case Sparkles
   * carries no color class — already excluded by the pattern itself.
   * Ecosystem.tsx uses `Sparkles text-orange-500` as a section heading
   * icon (paired with the literal `<h2>Redemption Loop</h2>` element, not
   * a celebration framing). On the on-chain/token dashboard page the
   * orange-500 shade IS the brand identity (paired with BurnTracker and
   * SGCoinCard). Explicitly allowlisted — same intent as the documented
   * `Sparkles text-brand-accent` keep on Checkout's store credit section.
   */
  {
    id: 'URG-SPARKLES-CELEBRATION',
    description: 'Sparkles icon rendered with urgency/carnival-color text class in inline JSX',
    pattern: /<Sparkles\b[^>]*?\bclassName=[^>]*?\btext-(?:green|orange|red|yellow|amber)-(?:400|500)\b/,
    allowlist: [
      { file: 'pages/Ecosystem.tsx', reason: 'Sparkles heading-icons on the on-chain dashboard page (orange IS the page brand-color, paired with literal h2 section headings not celebration framing)' },
    ],
  },
  /**
   * Rule 2: Shout-copy.
   * Specific all-caps urgency phrases. The AnnouncementBar mentions
   * "FLASH SALE" only in the historical-replacement comment explaining
   * why the PromoBar was deleted — exempted explicitly.
   */
  {
    id: 'URG-SHOUT-COPY',
    description: 'Urgency phrases and shouty caps shipping/sale copy',
    pattern: /\b(?:FLASH\s+SALE|ENDS\s+SOON|LIMITED\s+TIME|ACT\s+NOW|ORDER\s+NOW|ONLY\s+\d+\s+LEFT|FREE\s+SHIPPING\s+ON\s+ALL\s+ORDERS)\b/,
    allowlist: [
      { file: 'components/AnnouncementBar.tsx', reason: 'Historical replacement-comment reference (documenting the deleted PromoBar)' },
    ],
  },
  /**
   * Rule 3: Imports of removed or @deprecated components.
   * Tighter than file existence — catches drift if a future contributor
   * re-introduces a reference to the deleted urgency-chrome components.
   */
  {
    id: 'URG-DEPRECATED-IMPORT',
    description: 'Import of removed or @deprecated urgency component',
    pattern: /from\s+['"](?:[\.]{1,2}\/)+components\/(?:PromoBar|ui\/CountdownTimer|CartUpsells|ui\/FreeShippingBar)(?:\.\w+)?['"]/,
    allowlist: [],
  },
  /**
   * Rule 4: References to removed synthetic-pressure utility
   * functions. The wedge deleted `generateViewCount`, `getRecentSales`,
   * `hasActiveFlashSale`, `getTimeRemaining`, `formatTimeRemaining` from
   * `utils/urgencyUtils.ts`. If a real viewer count is needed, surface
   * it server-side instead.
   */
  {
    id: 'URG-OBSOLETE-UTILS',
    description: 'Reference to removed urgency-chrome utility function (use server-side analytics)',
    pattern: /\b(?:generateViewCount|getRecentSales|hasActiveFlashSale|getTimeRemaining|formatTimeRemaining)\b/,
    allowlist: [],
  },
];

// ============================================================
// WALKER + MATCHER
// ============================================================

/**
 * Files that are @deprecated by the Peaceful Space wedge (docs/peaceful-space.md
 * "Do Not Re-Introduce" section). Their content is dead code that imports no
 * longer resolve to. Skipping them avoids flagging legacy chromatic content
 * the framework explicitly marked as deprecated rather than removed.
 */
const SKIP_FILES = new Set<string>([
  'components/CartUpsells.tsx',
  'components/ui/FreeShippingBar.tsx',
]);

function walkFiles(absDir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(absDir, e.name);
    if (e.isDirectory()) {
      out.push(...walkFiles(p));
      continue;
    }
    if (!/\.tsx$/.test(e.name) || /\.test\.tsx$/.test(e.name)) continue;
    const relative = path.relative(PROJECT_ROOT, p).replace(/\\/g, '/');
    if (SKIP_FILES.has(relative)) continue;
    out.push(p);
  }
  return out;
}

function isFileAllowed(relativePath: string, matchedLine: string, allowlist: AllowlistEntry[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  return allowlist.some((entry) => {
    if (!normalized.includes(entry.file)) return false;
    if (entry.scenario && !matchedLine.includes(entry.scenario)) return false;
    return true;
  });
}

/**
 * Scan a single file's content. Factored out from scan() so the test suite
 * can verify rule precision against synthetic fixtures without writing temp
 * files on disk. `relativeFilePath` should be forward-slash normalized.
 */
function scanFile(relativeFilePath: string, content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');
  for (const rule of RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!rule.pattern.test(line)) continue;
      if (isFileAllowed(relativeFilePath, line, rule.allowlist)) continue;
      violations.push({
        ruleId: rule.id,
        description: rule.description,
        file: relativeFilePath,
        line: i + 1,
        matchedText: line.trim().slice(0, 200),
      });
    }
  }
  return violations;
}

function scan(): Violation[] {
  const violations: Violation[] = [];
  const scanDirs = ['pages', 'components'];
  for (const dir of scanDirs) {
    const files = walkFiles(path.join(PROJECT_ROOT, dir));
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relative = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
      violations.push(...scanFile(relative, content));
    }
  }
  return violations;
}

// ============================================================
// OUTPUT
// ============================================================

function printResults(v: Violation[]): void {
  if (v.length === 0) {
    console.log('✅ Peaceful Space audit clean — zero urgency-chrome drift detected across pages/ and components/.');
    return;
  }
  console.error(`\n🚨 Peaceful Space audit — ${v.length} violation${v.length === 1 ? '' : 's'} found\n`);
  console.error(`Every violation below is a candidate drift from the framework in ${DOCS_REF}.\n`);
  // Group by file for readability.
  const byFile = new Map<string, Violation[]>();
  for (const violation of v) {
    if (!byFile.has(violation.file)) byFile.set(violation.file, []);
    byFile.get(violation.file)!.push(violation);
  }
  for (const [file, vs] of byFile) {
    console.error(`\n📄 ${file}`);
    for (const violation of vs) {
      console.error(`   ❌ Line ${violation.line}  [${violation.ruleId}]`);
      console.error(`      → ${violation.description}`);
      console.error(`      → ${violation.matchedText}`);
    }
  }
  console.error(`\n📖 Reference: ${DOCS_REF}`);
  console.error(`\nIf a violation is intentional (a Kept Pattern):`);
  console.error(`   1. Add the file (+ scenario) to the rule's \`allowlist\` in scripts/audit-urgency-chrome.ts`);
  console.error(`   2. Document the keep in ${DOCS_REF} "Kept Patterns" section\n`);
}

function main(): void {
  const violations = scan();
  printResults(violations);
  process.exit(violations.length === 0 ? 0 : 1);
}

// Only run `main()` when this module is executed directly (e.g.
// `tsx scripts/audit-urgency-chrome.ts`) and not when imported by the
// test suite. The `pathToFileURL` cross-platform guard mirrors the one
// used in scripts/generateSeoArtifacts.mjs — Windows uses backslashes
// for `process.argv[1]` so a naive string compare would not match.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { scan, scanFile, RULES, walkFiles, isFileAllowed };
