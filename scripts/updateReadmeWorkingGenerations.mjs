import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.resolve(__dirname, '../README.md');

let content = fs.readFileSync(readmePath, 'utf8');

// Find the production incident section
const oldHeading = '## Production incident: customer checkout at 503';
const sectionEndMarker = '# Coalition Brand - E-commerce Platform';

const startIdx = content.indexOf(oldHeading);
const endIdx = content.indexOf(sectionEndMarker, startIdx);

if (startIdx === -1) {
  console.error('ERROR: Could not find old section start');
  process.exit(1);
}
if (endIdx === -1) {
  console.error('ERROR: Could not find section end');
  process.exit(1);
}

const before = content.slice(0, startIdx);
const after = content.slice(endIdx);

const newSection = '## Working generations \u2014 deployment state as of 2026-07-10\r\n\r\n'
  + '### The "perfect UI" \u2014 known-good target for restoration\r\n\r\n'
  + 'The best-known UI generation is **deployment `dpl_75Vza3u5F1cqwmK83qvGXV9x4ANg`** at commit **`e3b94e2`** (`fix(images): commit shorts front image so PDP gallery resolves all 4 thumbnails`), bundle `assets/index-CzMoBt7O.js`. This deployment had the highest-quality UI with the most polished product card grid, PDP rendering, and checkout layout \u2014 the "perfect" version the user approved.\r\n\r\n'
  + '**To restore the perfect UI:**\r\n```bash\r\nvercel rollback dpl_75Vza3u5F1cqwmK83qvGXV9x4ANg --yes\r\n```\r\n\r\n'
  + '\u26a0\ufe0f **Trade-off:** the perfect UI ships with an older `api/[...slug].ts` that uses extensionless dynamic imports (`import(\'./_handlers/paypal-order\')` instead of `import(\'./_handlers/paypal-order.js\')`), causing `ERR_MODULE_NOT_FOUND` on every `/api/*` endpoint. To restore the perfect UI WITH working API:\r\n\r\n'
  + '1. Check out commit `e3b94e2` as baseline.\r\n'
  + '2. Cherry-pick the ESM `.js` extension fix from commit `7ef19f7` (adds `.js` to all dynamic imports).\r\n'
  + '3. Rebuild and deploy with build cache off (`vercel --prod --force`).\r\n'
  + '4. Verify `/api/paypal-order` returns 200.\r\n\r\n'
  + '### Current working state (`sgcoalition.xyz`)\r\n\r\n'
  + '- **Bundle:** `assets/index-CFMsameB.js` (latest deploy \u2014 contains the SearchResults loading-guard fix, 7 missing products added to INITIAL_PRODUCTS, category type fixes, and real image URLs)\r\n'
  + '- **API handlers:** all fixed \u2014 `api/_handlers/*.ts` uses `.js` extensions for ESM import resolution. `/api/paypal-order`, `/api/complete-order`, `/api/ai-chat`, `/api/marketing-subscribe` all return 200.\r\n'
  + '- **Products:** 26 on the live shop page (up from 19), including all Women\'s products, Halo Mini Dress, and Above As Below Set \u2014 verified working in the browser with no broken images.\r\n'
  + '- **Search:** "Women" returns 4 results (all Women\'s products) \u2014 loading guard prevents false "No results found" during Supabase fetch.\r\n'
  + '- **API rate limiter, CSP headers, ErrorBoundary, Sentry:** all wired and locked by `tests/securityInfrastructureReadiness.test.ts`.\r\n\r\n'
  + '### Next steps to reach perfect UI\r\n\r\n'
  + '1. `vercel rollback dpl_75Vza3u5F1cqwmK83qvGXV9x4ANg --yes`\r\n'
  + '2. Cherry-pick `7ef19f7` (ESM `.js` extension fix) onto the rolled-back commit.\r\n'
  + '3. Deploy with build cache off.\r\n'
  + '4. Verify API handlers return 200 + the UI matches the perfect generation.\r\n\r\n';

content = before + newSection + after;

// Update TOC - remove the old emoji entry
content = content.replace(
  '- [\uD83D\uDEA8 Production incident](#production-incident-customer-checkout-at-503)',
  '- [Working generations](#working-generations--deployment-state-as-of-2026-07-10)'
);

fs.writeFileSync(readmePath, content, 'utf8');
console.log('SUCCESS: Replaced the production incident section with working generations');
console.log('File size:', (content.length / 1000).toFixed(1), 'KB');
