/**
 * scripts/productSeed.ts — the single owner of the rule that refreshes
 * `constants/products.ts` without destroying what it does not own.
 *
 * The seed file is **not** a mirror of the `products` table. It is the fallback the
 * app reads when Supabase is unreachable, and it carries entries the table has never
 * held — the four `Coalition_Parts_Wallet_*` rows and `prod_wallet_chrome_hearts`
 * have no DB row at all. A refresh may therefore add and correct, but it must never
 * delete, and never silently rewrite an entry nobody asked about. The wholesale
 * mirror refresh that used to live in `syncProducts.ts` did both: it deleted those
 * five wallets and absorbed an unrelated price change, failing 21 tests.
 *
 * The rule, in one place:
 *   1. an entry already in the seed keeps its position and its exact contents,
 *      unless its id is targeted
 *   2. a targeted id is rewritten from its DB row — this is how a drop publish
 *      corrects the listing it owns (`upsertDropProduct` passes `--only <id>`)
 *   3. a DB row with no seed entry is appended, so products added in admin still
 *      reach the seed
 *   4. nothing is ever removed, including seed-only entries with no DB row
 *   5. a difference on an untargeted entry is reported as drift and left alone
 *
 * Pure by design: no IO, no client, so the script and its test read the same rule.
 */
import type { Product } from '../types';

/** The `products` columns this mapping reads. Mirrors the live table. */
export interface ProductRow {
  id: string;
  name?: string | null;
  price?: number | null;
  images?: unknown;
  description?: string | null;
  category?: string | null;
  is_featured?: boolean | null;
  is_limited_edition?: boolean | null;
  sizes?: unknown;
  size_inventory?: unknown;
  nft_metadata?: unknown;
  archived?: boolean | null;
  archived_at?: string | null;
  released_at?: string | null;
  sold_at?: string | null;
}

export interface SeedMergeReport {
  /** Entries named explicitly by the caller. */
  targeted: string[];
  /** Of those, the ones whose data actually differed. */
  rewritten: string[];
  /** Entries kept that the DB has no row for at all. */
  seedOnly: string[];
  /** DB rows the seed had never seen, appended in DB order. */
  added: string[];
  /** Differences on untargeted entries — reported, never applied. */
  drift: Array<{ id: string; field: string; seed: unknown; db: unknown }>;
}

/**
 * DB row → seed entry. Field names and trimming mirror `services/retryQueue.ts`
 * mapProductToDb (the reverse direction), so a round trip is lossless.
 */
export function mapDbRowToSeedEntry(row: ProductRow): Product {
  const category = row.category?.toLowerCase()?.trim();
  return {
    id: row.id,
    name: row.name?.trim(),
    price: row.price as number,
    images: row.images,
    description: row.description?.trim(),
    category: (category === 'accessories' ? 'accessory' : category) as Product['category'],
    isFeatured: row.is_featured,
    isLimitedEdition: row.is_limited_edition ?? false,
    sizes: row.sizes,
    sizeInventory: row.size_inventory,
    nft: row.nft_metadata,
    archived: row.archived,
    archivedAt: row.archived_at,
    releasedAt: row.released_at,
    soldAt: row.sold_at,
  } as Product;
}

/**
 * Fold the DB rows into the seed under the rule above. Order is stable: existing
 * entries keep their positions, new rows are appended in the order given.
 */
export function mergeSeedProducts(
  existing: Product[],
  dbRows: ProductRow[],
  targetedIds: string[] = [],
): { products: Product[]; report: SeedMergeReport } {
  const targeted = new Set(targetedIds);
  const pending = new Map<string, Product>();
  for (const row of dbRows) pending.set(String(row.id), mapDbRowToSeedEntry(row));

  const products: Product[] = [];
  const report: SeedMergeReport = { targeted: [], rewritten: [], seedOnly: [], added: [], drift: [] };

  for (const entry of existing) {
    const id = String(entry.id);
    const fromDb = pending.get(id);

    if (!fromDb) {
      products.push(entry);
      report.seedOnly.push(id);
      continue;
    }
    pending.delete(id);

    if (targeted.has(id)) {
      products.push(fromDb);
      report.targeted.push(id);
      if (!sameSeedEntry(entry, fromDb)) report.rewritten.push(id);
      continue;
    }

    for (const field of Object.keys(fromDb) as Array<keyof Product>) {
      if (JSON.stringify(entry[field]) !== JSON.stringify(fromDb[field])) {
        report.drift.push({ id, field: String(field), seed: entry[field], db: fromDb[field] });
      }
    }
    products.push(entry);
  }

  for (const [id, entry] of pending) {
    products.push(entry);
    report.added.push(id);
  }

  return { products, report };
}

/**
 * The ids a caller may name that exist nowhere — neither as a seed entry nor as a DB
 * row. An id that matches nothing is almost always a typo, and a typo on `--only`
 * would otherwise read as a successful no-op publish. Kept here so "what an id can
 * refer to" has one owner, next to the rule that consumes it.
 */
export function unknownSeedIds(
    existing: Product[],
    dbRows: ProductRow[],
    ids: string[],
): string[] {
    const known = new Set<string>([
        ...existing.map((entry) => String(entry.id)),
        ...dbRows.map((row) => String(row.id)),
    ]);
    return ids.filter((id) => !known.has(id));
}

const ARRAY_DECLARATION = 'export const INITIAL_PRODUCTS: Product[] = ';

interface SeedArrayItem {
    id: string | null;
    /** Text between the previous entry (or the `[`) and this entry: separators + comments. */
    gap: string;
    /** This entry's exact source text. */
    source: string;
}

interface SeedArrayLayout {
    /** File text up to and including the array's opening `[`. */
    head: string;
    /** Gap before the first entry. */
    firstGap: string;
    items: SeedArrayItem[];
    /** From the array's closing `]` to the end of the file. */
    tail: string;
}

/**
 * Rewrite the seed array, re-serialising only the entries whose data changed.
 *
 * An unchanged entry keeps its exact source text, which is what preserves the
 * hand-written comments inside the array (and the escape style of older entries) —
 * a wholesale `JSON.stringify` of the whole list silently deleted both. A run that
 * changes nothing therefore leaves the file byte-identical, so `--confirm` is safe
 * to repeat.
 *
 * The current entries are read from the file text itself, so a caller needs nothing
 * but the text and the merged list — no parsed copy to keep in sync.
 */
export function replaceSeedArray(fileText: string, products: Product[]): string {
    const layout = parseSeedArray(fileText);
    const eol = fileText.includes('\r\n') ? '\r\n' : '\n';
    // The gap this is spliced after already carries the entry's two-space indent,
    // so the block starts at the brace — including the indent here landed a
    // rewritten entry two spaces too deep (invisible on the no-op path).
    const serialize = (product: Product) =>
        JSON.stringify(product, null, 2).replace(/\n/g, eol + '  ');

    const byId = new Map(
        layout.items
            .filter((item): item is SeedArrayItem & { id: string } => Boolean(item.id))
            .map((item) => [item.id, item]),
    );

    const pieces: string[] = [];
    let first = true;

    for (const product of products) {
        const id = String(product.id);
        const item = byId.get(id);

        if (item) {
            byId.delete(id);
            const unchanged = sameSeedEntry(parseEntry(item), product);
            pieces.push(
                (first ? layout.firstGap : item.gap) + (unchanged ? item.source : serialize(product)),
            );
        } else {
            pieces.push((first ? layout.firstGap : `,${eol}  `) + serialize(product));
        }
        first = false;
    }

    if (byId.size) {
        // Every entry the file has must be accounted for; dropping one would be the
        // exact bug this module exists to prevent.
        throw new Error(
            `constants/products.ts: refusing to write — ${[...byId.keys()].join(', ')} would be dropped.`,
        );
    }

    return layout.head + pieces.join('') + layout.tail;
}

/**
 * The seed entries as data, read from the file's own text — the input to
 * `mergeSeedProducts`. Comments inside the array are skipped, not parsed.
 */
export function parseSeedEntries(fileText: string): Product[] {
    return parseSeedArray(fileText).items.map(parseEntry);
}

/**
 * Read → merge → splice in one step, so every caller applies the same rule and none
 * has to remember the three-call sequence. Takes and returns file *text* (not a path),
 * which is what lets the GitHub Contents API path and the local fs path share it.
 *
 * `targetedIds` is the whole of the destructive/non-destructive decision: an id in that
 * list is rewritten from its DB row (a publish owns its listing; the admin sync owns
 * every row the table holds), and everything else is left exactly as written.
 */
export function refreshSeed(
    fileText: string,
    dbRows: ProductRow[],
    targetedIds: string[] = [],
): { text: string; report: SeedMergeReport; changed: boolean } {
    const { products, report } = mergeSeedProducts(parseSeedEntries(fileText), dbRows, targetedIds);
    const text = replaceSeedArray(fileText, products);
    return { text, report, changed: text !== fileText };
}

/** One entry's source text → data. Throws rather than guessing. */
function parseEntry(item: SeedArrayItem): Product {
    try {
        return JSON.parse(stripComments(item.source)) as Product;
    } catch {
        throw new Error(
            `constants/products.ts: entry ${item.id ?? '(no id)'} is not readable as JSON — refusing to write.`,
        );
    }
}

/** Remove `//` and block comments that sit outside string literals. */
function stripComments(text: string): string {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            const end = skipString(text, i);
            out += text.slice(i, end + 1);
            i = end;
            continue;
        }
        if (char === '/' && text[i + 1] === '/') {
            const nl = text.indexOf('\n', i);
            if (nl === -1) break;
            i = nl - 1;
            continue;
        }
        if (char === '/' && text[i + 1] === '*') {
            const close = text.indexOf('*/', i + 2);
            if (close === -1) break;
            i = close + 1;
            continue;
        }
        out += char;
    }
    return out;
}

/** Deep equality for one seed entry, ignoring key order. */
export function sameSeedEntry(a: Product, b: Product): boolean {
    const left = a as unknown as Record<string, unknown>;
    const right = b as unknown as Record<string, unknown>;
    for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) return false;
    }
    return true;
}

/** Walk the array literal, keeping each entry's source text and its preceding gap. */
function parseSeedArray(fileText: string): SeedArrayLayout {
    const declaration = fileText.indexOf(ARRAY_DECLARATION);
    if (declaration === -1) {
        throw new Error(
            `constants/products.ts is missing "${ARRAY_DECLARATION.trim()}" — refusing to write the seed.`,
        );
    }
    const open = fileText.indexOf('[', declaration + ARRAY_DECLARATION.length);
    if (open === -1) {
        throw new Error('constants/products.ts: INITIAL_PRODUCTS is not an array literal — refusing to write.');
    }

    const items: SeedArrayItem[] = [];
    let cursor = open + 1;
    let tail = fileText.length;

    for (let i = open + 1; i < fileText.length; i++) {
        const char = fileText[i];

        if (char === '"') {
            i = skipString(fileText, i);
            continue;
        }
        if (char === '/' && fileText[i + 1] === '/') {
            const nl = fileText.indexOf('\n', i);
            if (nl === -1) break;
            i = nl;
            continue;
        }
        if (char === '/' && fileText[i + 1] === '*') {
            const close = fileText.indexOf('*/', i + 2);
            if (close === -1) break;
            i = close + 1;
            continue;
        }
        if (char === '{') {
            const end = skipObject(fileText, i);
            const source = fileText.slice(i, end);
            items.push({ id: idFromEntrySource(source), gap: fileText.slice(cursor, i), source });
            cursor = end;
            i = end - 1;
            continue;
        }
        if (char === ']') {
            // Everything from the end of the last entry: trailing comments, the
            // closing bracket, and whatever follows in the file.
            tail = cursor;
            break;
        }
    }

    return { head: fileText.slice(0, open + 1), firstGap: items[0]?.gap ?? '', items, tail: fileText.slice(tail) };
}

/** Index just past the string that starts at `at` (the opening quote). */
function skipString(text: string, at: number): number {
    for (let i = at + 1; i < text.length; i++) {
        if (text[i] === '\\') i++;
        else if (text[i] === '"') return i;
    }
    throw new Error('constants/products.ts: unterminated string in INITIAL_PRODUCTS — refusing to write.');
}

/** Index just past the `}` matching the `{` at `at`. */
function skipObject(text: string, at: number): number {
    let depth = 0;
    for (let i = at; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            i = skipString(text, i);
            continue;
        }
        if (char === '/' && text[i + 1] === '/') {
            const nl = text.indexOf('\n', i);
            if (nl === -1) break;
            i = nl;
            continue;
        }
        if (char === '/' && text[i + 1] === '*') {
            const close = text.indexOf('*/', i + 2);
            if (close === -1) break;
            i = close + 1;
            continue;
        }
        if (char === '{') depth++;
        else if (char === '}') {
            depth--;
            if (depth === 0) return i + 1;
        }
    }
    throw new Error('constants/products.ts: unterminated object in INITIAL_PRODUCTS — refusing to write.');
}

function idFromEntrySource(source: string): string | null {
    const match = source.match(/"id"\s*:\s*"([^"]+)"/);
    return match ? match[1] : null;
}

/**
 * One readable value for a drift line — a whole image array printed twice is not a
 * report. Arrays are reported by size; long strings are clipped.
 */
export function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
  const text = JSON.stringify(value);
  if (text === undefined) return String(value);
  return text.length > 48 ? `${text.slice(0, 48)}…` : text;
}

/** Printable lines for the merge, so the wording is owned here too. */
export function formatSeedMergeReport(report: SeedMergeReport, targetedRequested: boolean): string[] {
  const lines: string[] = [];
  if (report.rewritten.length) lines.push(`  ✓ rewritten from the DB   ${report.rewritten.join(', ')}`);
  const current = report.targeted.filter((id) => !report.rewritten.includes(id));
  if (current.length) lines.push(`  · already current         ${current.join(', ')}`);
  if (report.added.length) lines.push(`  + appended (new in DB)    ${report.added.join(', ')}`);
  if (report.seedOnly.length) lines.push(`  ⌂ kept (no DB row)        ${report.seedOnly.join(', ')}`);
  for (const d of report.drift) {
    lines.push(
      `  ⚠️  drift NOT applied      ${d.id}.${d.field}: seed ${summarizeValue(d.seed)} vs db ${summarizeValue(d.db)}`,
    );
  }
  if (report.drift.length && !targetedRequested) {
    lines.push('     (drift is reported only — target an id with --only <id> to rewrite it)');
  }
  return lines;
}
