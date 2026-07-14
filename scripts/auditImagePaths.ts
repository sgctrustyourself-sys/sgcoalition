// scripts/auditImagePaths.ts
//
// Image-Path Audit (dry-run, no writes).
//
// Read `constants.ts` and print every product whose `images[]` contains a
// URL the runtime can't serve cleanly. Operator fixes the broken entries
// by hand via the admin dashboard (re-upload through Supabase storage) or
// by editing constants.ts directly.
//
// USAGE:   npx.cmd tsx scripts/auditImagePaths.ts
// EXIT:    0 clean, 1 broken. Safe to wire into scheduled CI.
//
// SCOPE:   INITIAL_PRODUCTS only. PRODUCT_LOCAL_OVERRIDES has no `images`
//          overrides at write-time so its anchor never matches.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FILE = join(__dirname, '..', 'constants.ts');

// Canonical hosts the storefront's <img> tags can resolve.
//   i.imgur.com              : direct-img CDN used by admin imgurService writes
//   tvacscfb<...>.supabase.co: project Supabase public-storage bucket.
const CANONICAL_PATTERNS: ReadonlyArray<RegExp> = [
  /^https:\/\/i\.imgur\.com\//i,
  /^https:\/\/tvacscfbzcmjlcekjcsn\.supabase\.co\/storage\//i,
];

const BROKEN_PATTERNS: ReadonlyArray<{ name: BrokenReason; re: RegExp }> = [
  { name: 'LOCAL_RELATIVE_PATH', re: /^\/(?!\/)/ },
  { name: 'INSECURE_HTTP', re: /^http:\/\//i },
];

type BrokenReason =
  | 'LOCAL_RELATIVE_PATH'
  | 'INSECURE_HTTP'
  | 'NON_CANONICAL_HOST'
  | 'OTHER';

interface ImageIssue { url: string; reason: BrokenReason }

interface AuditRow {
  id: string;
  name: string;
  brokenCount: number;
  totalCount: number;
  issues: ImageIssue[];
}

// Block boundary: each INITIAL_PRODUCTS row starts with a 2-space-indent
// `{` followed by `"id":`. PRODUCT_LOCAL_OVERRIDES uses unquoted keys so
// its anchor never matches.
const BLOCK_BOUNDARY = /(?=\{\s*\n\s*"id"\s*:\s*")/g;

function unescape(s: string): string {
  return s
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function classify(url: string): BrokenReason | null {
  if (CANONICAL_PATTERNS.some((re) => re.test(url))) return null;
  for (const p of BROKEN_PATTERNS) {
    if (p.re.test(url)) return p.name;
  }
  if (!/^https?:\/\//i.test(url)) return 'OTHER';
  return 'NON_CANONICAL_HOST';
}

function audit(): AuditRow[] {
  const src = readFileSync(FILE, 'utf8');
  const blocks = src.split(BLOCK_BOUNDARY);
  const rows: AuditRow[] = [];

  for (const block of blocks) {
    const idMatch = block.match(/^\s*"id"\s*:\s*"((?:[^"\\]|\\.)*)"/m);
    const nameMatch = block.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!idMatch) continue;
    const id = unescape(idMatch[1]);
    const name = nameMatch ? unescape(nameMatch[1]) : '(unknown)';

    const arrMatch = block.match(/"images"\s*:\s*\[([\s\S]*?)\]/);
    if (!arrMatch) continue;
    const arrBody = arrMatch[1];

    const urlRe = /"((?:https?:\/\/|\/)[^"]+)"/g;
    const issues: ImageIssue[] = [];
    let total = 0;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(arrBody))) {
      total += 1;
      const reason = classify(m[1]);
      if (reason) issues.push({ url: m[1], reason });
    }
    if (issues.length > 0) {
      rows.push({ id, name, brokenCount: issues.length, totalCount: total, issues });
    }
  }
  return rows;
}

function print(rows: ReadonlyArray<AuditRow>): void {
  console.log('========================================================');
  console.log(' Coalition Image-Path Audit (dry-run, no writes)');
  console.log('========================================================');
  console.log('File:    ' + FILE);
  console.log(
    rows.length === 0
      ? 'Status:  ALL CLEAN'
      : `Status:  ${rows.length} product(s) with broken images`,
  );
  console.log();

  if (rows.length === 0) {
    console.log('  ✓ Every product.images[] URL resolves to i.imgur.com or Supabase storage.');
    console.log();
    return;
  }

  const sorted = [...rows].sort(
    (a, b) => b.brokenCount - a.brokenCount || a.id.localeCompare(b.id),
  );

  for (const r of sorted) {
    console.log('  ' + r.id);
    console.log('    Name:    ' + r.name);
    console.log('    Broken:  ' + r.brokenCount + ' / ' + r.totalCount);
    for (const issue of r.issues) {
      console.log('    - [' + issue.reason + '] ' + issue.url);
    }
    console.log();
  }

  console.log('--- Repair guidance ---');
  console.log('  LOCAL_RELATIVE_PATH : re-upload the asset to Supabase storage');
  console.log('                       (admin dashboard "Sync Code" can auto-migrate');
  console.log('                       if the asset exists on disk in /public/images/).');
  console.log('  INSECURE_HTTP       : convert to https or replace entirely.');
  console.log('  NON_CANONICAL_HOST  : confirm the host actually serves the file.');
  console.log('  OTHER               : non-URL value — almost certainly a typo.');
}

const rows = audit();
print(rows);
process.exit(rows.length === 0 ? 0 : 1);
