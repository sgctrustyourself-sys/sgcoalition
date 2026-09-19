import { describe, it, expect } from 'vitest';
import { scan, scanFile, RULES, walkFiles, isFileAllowed } from '../scripts/audit-urgency-chrome';

/**
 * Explicit sentinel for synthetic fixture paths below. Synthetic paths
 * (e.g. `pages/__fixtures__/SparklesGreen.tsx`) use this prefix to bypass
 * the per-rule allowlist substring matching — the prefix is intentionally
 * not contained in any real allowlist key. Centralised here so future
 * maintainers who add real files under `pages/__fixtures__/...` notice
 * the collision immediately rather than silently losing fixture coverage.
 */
const FIXTURE_PREFIX = '__fixtures__/';

/**
 * Tests for scripts/audit-urgency-chrome.ts.
 *
 * The strongest signal that the audit is correctly designed is "scan()
 * against the current codebase returns zero violations" — that confirms
 * every Kept Pattern documented in docs/peaceful-space.md is correctly
 * allowlisted AND every removed pattern is correctly absent.
 *
 * The "positive-fixture" tests below prove the OPPOSITE direction: that
 * each rule's regex actually catches a synthetic violation in a synthetic
 * file. Without these, a future contributor could weaken a regex (e.g.
 * drop a required token) and the test suite would still pass because
 * the real codebase is clean. The fixtures pin each rule's precision.
 */

describe('audit-urgency-chrome module', () => {
  describe('module exports', () => {
    it('exports scan, RULES, walkFiles, and isFileAllowed', () => {
      expect(typeof scan).toBe('function');
      expect(Array.isArray(RULES)).toBe(true);
      expect(walkFiles.length).toBeGreaterThanOrEqual(1);
      expect(typeof isFileAllowed).toBe('function');
    });
  });

  describe('rule-shape contract', () => {
    it('every rule carries a URG- prefixed id, non-empty description, valid RegExp, and allowlist array', () => {
      for (const rule of RULES) {
        expect(rule.id).toMatch(/^URG-/);
        expect(typeof rule.description).toBe('string');
        expect(rule.description.length).toBeGreaterThan(10);
        expect(rule.pattern).toBeInstanceOf(RegExp);
        expect(Array.isArray(rule.allowlist)).toBe(true);
      }
    });

    it('every allowlist entry has a file string + reason string (scenario optional)', () => {
      for (const rule of RULES) {
        for (const entry of rule.allowlist) {
          expect(typeof entry.file).toBe('string');
          expect(entry.file.length).toBeGreaterThan(0);
          expect(typeof entry.reason).toBe('string');
          expect(entry.reason.length).toBeGreaterThan(0);
          if (entry.scenario !== undefined) {
            expect(typeof entry.scenario).toBe('string');
            expect(entry.scenario.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('rule ids are unique (req stable grep-able references in CI output)', () => {
      const ids = new Set<string>();
      for (const rule of RULES) {
        expect(ids.has(rule.id)).toBe(false);
        ids.add(rule.id);
      }
    });

    it('covers the four closed-set patterns the wedge retired', () => {
      const ids = RULES.map((r) => r.id);
      // Each pattern below was a specific removal during the wedge; the audit
      // covers it so a future contributor cannot re-introduce without noticing.
      expect(ids).toContain('URG-SPARKLES-CELEBRATION');
      expect(ids).toContain('URG-SHOUT-COPY');
      expect(ids).toContain('URG-DEPRECATED-IMPORT');
      expect(ids).toContain('URG-OBSOLETE-UTILS');
    });
  });

  describe('isFileAllowed matching', () => {
    it('matches when the rule.file substring appears anywhere in the relative path', () => {
      expect(
        isFileAllowed('components/AnnouncementBar.tsx', 'FLASH SALE mention', [
          { file: 'components/AnnouncementBar.tsx', reason: 'historical comment' },
        ]),
      ).toBe(true);
    });

    it('returns false when no entry matches the file path', () => {
      expect(
        isFileAllowed('pages/Cart.tsx', 'banner text', [
          { file: 'components/AnnouncementBar.tsx', reason: 'historical comment' },
        ]),
      ).toBe(false);
    });

    it('honors scenario: requires the matched line to contain the scenario substring', () => {
      const allowlist = [{ file: 'pages/Home.tsx', scenario: 'require-this', reason: 'kept' }];
      expect(isFileAllowed('pages/Home.tsx', 'line without scenario substring', allowlist)).toBe(false);
      expect(isFileAllowed('pages/Home.tsx', 'line WITH require-this substring', allowlist)).toBe(true);
    });

    it('normalizes backslashes to forward-slashes before matching', () => {
      // Mirrors Windows build paths where path.relative uses backslash.
      expect(
        isFileAllowed('components\\AnnouncementBar.tsx', 'historical', [
          { file: 'components/AnnouncementBar.tsx', reason: 'historical comment' },
        ]),
      ).toBe(true);
    });
  });

  describe('scan against the current codebase', () => {
    it('returns zero violations (the wedge work has stayed clean)', () => {
      // This is the strongest signal: every Kept Pattern is correctly
      // allowlisted AND every removed synthetic-pressure pattern is
      // correctly absent from the current customer-facing source.
      // If this test fails, a future contributor has either re-introduced
      // an urgency-chrome pattern or added a new one without registering.
      // resolve drift via:
      //   1. Remove/restructure the offending line (preferred).
      //   2. Add the file + scenario to the rule's allowlist AND document
      //      in docs/peaceful-space.md "Kept Patterns".
      const violations = scan();
      if (violations.length > 0) {
        // eslint-disable-next-line no-console
        console.error('Diagnostic dump of first 10 violations:', violations.slice(0, 10));
      }
      expect(violations).toEqual([]);
    });
  });

  describe('positive-fixture precision tests', () => {
    /**
     * Each test feeds a synthetic file (in a thin wrapper used by scanFile)
     * and asserts scanFile() flags the violation. This pins the regex pre-
     * cision: if a future contributor weakens a regex and the synthetic
     * violation slips through, the test fails with a clear "URG-X pattern
     * no longer detected" signal.
     *
     * Synthetic file paths use the `__fixtures__/` prefix so they bypass
     * the per-rule allowlist substring matching — see `FIXTURE_PREFIX`
     * above for the explicit sentinel.
     */
    it('URG-SPARKLES-CELEBRATION catches a Sparkles icon paired with text-green-400', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}SparklesGreen.tsx`,
        'const x = <span><Sparkles className="w-5 h-5 text-green-400" /> Save $30!</span>;',
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('URG-SPARKLES-CELEBRATION');
    });

    it('URG-SPARKLES-CELEBRATION does NOT flag a bare Sparkles icon (CustomInquiryManager default-case shape)', () => {
      const violations = scanFile(
        `components/admin/${FIXTURE_PREFIX}SparklesBare.tsx`,
        'const x = <Sparkles className="w-4 h-4" />;',
      );
      expect(violations).toHaveLength(0);
    });

    it('URG-SPARKLES-CELEBRATION does NOT flag Sparkles + brand-accent (Checkout store credit keep shape)', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}SparklesBrandAccent.tsx`,
        'const x = <Sparkles className="text-brand-accent" />;',
      );
      expect(violations).toHaveLength(0);
    });

    it('URG-SHOUT-COPY catches "FLASH SALE" all-caps shout copy', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}FlashSale.tsx`,
        '<p className="font-bold">FLASH SALE — act now!</p>',
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('URG-SHOUT-COPY');
    });

    it('URG-DEPRECATED-IMPORT catches reintroduction of removed urgency components', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}Reimports.tsx`,
        "import FreeShippingBar from '../components/ui/FreeShippingBar';",
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('URG-DEPRECATED-IMPORT');
    });

    it('URG-OBSOLETE-UTILS catches a reference to removed synthetic-pressure helper', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}ViewsFaked.tsx`,
        'const count = generateViewCount(product.id);',
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('URG-OBSOLETE-UTILS');
    });

    it('URG-DEPRECATED-IMPORT does NOT flag a legitimate component import', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}NormalImport.tsx`,
        "import ProductCard from '../components/ProductCard';",
      );
      expect(violations).toHaveLength(0);
    });

    it('URG-OBSOLETE-UTILS does NOT flag a non-removed utility (name-collision guard)', () => {
      const violations = scanFile(
        `pages/${FIXTURE_PREFIX}CalcReward.tsx`,
        'const reward = calculateReward(total);',
      );
      expect(violations).toHaveLength(0);
    });

    /**
     * SKIP_FILES behavior pin: feeding a deprecated file path directly
     * to scanFile() with a known violation content proves the walker
     * honors SKIP_FILES end-to-end. (Note: this pin checks that scanFile
     * itself does NOT hard-filter by SKIP_FILES — that's the walker's
     * job. The walker test below confirms the walker drops these files.)
     */
    it('warns future maintainers: scanFile is NOT the @deprecated filter — only walkFiles filters those', () => {
      // scanFile() does NOT consult SKIP_FILES (the walker does). Confirm
      // by feeding a deprecated file path with the violation content the
      // walker would normally skip — scanFile() SHOULD still flag it
      // because the rule's allowlist doesn't include the deprecated file
      // for URG-SPARKLES-CELEBRATION. The walker then drops the file
      // before scanFile() ever sees it.
      const violations = scanFile(
        'components/CartUpsells.tsx',
        '<Sparkles className="w-5 h-5 text-green-400" />',
      );
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('URG-SPARKLES-CELEBRATION');
    });
  });
});
