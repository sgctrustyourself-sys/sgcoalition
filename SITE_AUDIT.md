# Coalition Brand — Site Audit Report
**Date:** April 15, 2026  
**Audited by:** Claude (Cowork)

---

## 🔴 Critical — Broken Links (Lead to 404)

### 1. Navbar Desktop: Dead Routes
Four links in the desktop navigation point to routes that **do not exist** in `App.tsx`:

| Link Label | Current Path | Issue |
|---|---|---|
| Blog | `/blog` | No page or route exists |
| Migrate to V2 | `/migrate` | No route — `MigrationPage.tsx` exists but isn't registered |
| Guide | `/guide` | No page exists |
| Recently Ordered | `/orders` | Wrong path — should be `/order-history` |

**File:** `components/Navbar.tsx` lines 46, 56, 57, 59

**Fix options:**
- **Blog** → Either create a `Blog.tsx` page and add the route, or remove the link until it's ready.
- **Migrate to V2** → Register `MigrationPage.tsx` in `App.tsx` under `/migrate`.
- **Guide** → Either create the page or remove the link.
- **Recently Ordered** → Change `to="/orders"` to `to="/order-history"`.

---

### 2. Raw `href="#/..."` Instead of React Router `<Link>`
Using raw hash hrefs inside a `HashRouter` app can cause unexpected navigation failures. These two instances should use `<Link>`:

- **`pages/About.tsx` line 186:**  
  `<a href="#/shop">` → `<Link to="/shop">`

- **`pages/Shop.tsx` line 86:**  
  `<a href="#/membership">` → `<Link to="/membership">`

---

### 3. Inconsistent Discord Invite Links
Two different Discord URLs are used across the site — one of them is likely wrong:

| File | URL |
|---|---|
| `components/Footer.tsx` | `https://discord.gg/bByqsC5f5V` |
| `pages/Help.tsx` | `https://discord.gg/bByqsC5f5V` |
| **`pages/BuySGCoin.tsx` line 410** | `https://discord.gg/coalition` ← **different** |

**Fix:** Verify which invite is valid and standardize to one URL across all files.

---

## 🟠 Important — Missing Content & Incomplete Pages

### 4. Footer Missing Legal Links
The footer has no links to the **Privacy Policy** (`/privacy`) or **Terms of Service** (`/terms`) pages, both of which exist and are fully built. These are legally important and commonly expected in a footer.

**File:** `components/Footer.tsx`  
**Fix:** Add these to the Quick Links column:
```tsx
<li><Link to="/privacy" className="...">Privacy Policy</Link></li>
<li><Link to="/terms" className="...">Terms of Service</Link></li>
```

---

### 5. Footer Copyright Year is Outdated
`© 2024 Coalition Brand. v1.2` — the year is hardcoded as **2024**. It's now 2026.

**Fix:** Use a dynamic year or update the string:
```tsx
© {new Date().getFullYear()} Coalition Brand. v1.2
```

---

### 6. Footer: Twitter Icon Imported But Never Used
`Twitter` is imported from `lucide-react` in `Footer.tsx` but there's no Twitter/X button rendered. Either add the social link or remove the unused import.

---

### 7. "Help" Appears Twice in the Desktop Navbar
The desktop nav has `Help` as both a standalone nav item **and** as an item inside the Resources dropdown. This is redundant and makes the nav look cluttered.

**File:** `components/Navbar.tsx` lines 55 and 65  
**Fix:** Remove the standalone `Help` link on line 65 — it's already accessible via the dropdown.

---

### 8. Mobile Menu is Missing Several Desktop Nav Items
The mobile menu (`Navbar.tsx`) is missing items that exist in the desktop nav:
- **Blog** (whether it's added or removed, mobile should match)
- **VIP Membership** (a key conversion path — it's in desktop but not mobile menu)
- **Resources / Custom Inquiry** (not accessible from mobile at all)

**Fix:** Add VIP and Custom Inquiry at minimum to the mobile menu for parity.

---

### 9. Pages That Exist as Files But Have No Route
These `.tsx` files are fully built but unreachable by users because they're never registered in `App.tsx`:

| File | Notes |
|---|---|
| `pages/AIPortal.tsx` | Full AI chat portal page — appears fully built |
| `pages/MigrationPage.tsx` | Referenced by Navbar's `/migrate` link |
| `pages/Cart.tsx` | Cart is currently handled via the `CartDrawer`, this page is a duplicate |
| `pages/Orders.tsx` | Duplicate of `OrderHistory.tsx`? Neither route points here |
| `pages/ProductPage.tsx` | Appears to be a duplicate of `ProductDetails.tsx` |

**Fix:** Decide for each whether to register a route or delete the file to keep the codebase clean.

---

### 10. About Page — Component Named `Story`, Route is `/about`
`pages/About.tsx` exports a component called `Story`, but the route is `/about` and the nav label is "About". This internal inconsistency won't break anything but is confusing for maintainability.

**Fix:** Rename the component from `Story` to `About` inside the file.

---

## 🟡 Improvements & Suggestions

### 11. `vercel.json` Missing SPA Catch-All Rewrite
The app uses `HashRouter`, so this is less critical — but the `vercel.json` only has an API rewrite and no catch-all fallback for the SPA. If you ever switch to `BrowserRouter`, all direct URL navigations would 404.

**Suggested addition to `vercel.json`:**
```json
{ "source": "/(.*)", "destination": "/index.html" }
```

---

### 12. Admin "Settings" Tab Shows "Coming Soon"
`pages/Admin.tsx` has a Settings tab with hardcoded placeholder text: *"Settings coming soon..."*. This surfaces an unfinished state to admins, which can look unprofessional.

**Fix:** Either build out the settings tab, or hide it from the UI until it's ready.

---

### 13. About Page — No CTA Links Back to Shop from Timeline
The brand story timeline section in `About.tsx` is compelling but has no mid-page call to action. Users reading the full story have to scroll all the way to the bottom to find the "Join The Movement" button.

**Fix:** Consider adding a small CTA after the timeline section (e.g., "Shop the Collection →") to capture intent earlier.

---

### 14. Privacy & Terms — `"last updated"` is Always Today's Date
Both `Privacy.tsx` and `Terms.tsx` use `new Date().toLocaleDateString()` as the "Last updated" date, meaning it shows today's date every time the page loads — even if the content hasn't changed. This is misleading and could be a legal compliance issue.

**Fix:** Hardcode the actual last-edited date as a string:
```tsx
<p>Last updated: January 15, 2025</p>
```

---

### 15. Hero Image on Home Page Uses Local Asset
`Home.tsx` references `bg-[url('/hero-cinematic.png')]` for the hero background. The file exists in `/public`, but if it's ever missing or the path changes, the hero section will appear blank with no fallback.

**Fix:** Add a fallback background color so the hero text is always readable if the image fails to load (e.g., `bg-black bg-[url('/hero-cinematic.png')]` — already does this since the parent is `bg-black`). Consider adding an `<img>` tag with proper `alt` text for accessibility.

---

## Summary Table

| # | Severity | Issue | File(s) |
|---|---|---|---|
| 1 | 🔴 Critical | 4 broken nav links (blog, migrate, guide, orders) | `Navbar.tsx` |
| 2 | 🔴 Critical | Raw `href="#/"` instead of `<Link>` | `About.tsx`, `Shop.tsx` |
| 3 | 🔴 Critical | Inconsistent Discord invite URL | `BuySGCoin.tsx` |
| 4 | 🟠 Important | Footer missing Privacy & Terms links | `Footer.tsx` |
| 5 | 🟠 Important | Footer copyright year stuck at 2024 | `Footer.tsx` |
| 6 | 🟠 Important | Unused Twitter import in Footer | `Footer.tsx` |
| 7 | 🟠 Important | Help link duplicated in desktop nav | `Navbar.tsx` |
| 8 | 🟠 Important | Mobile menu missing VIP + Custom Inquiry | `Navbar.tsx` |
| 9 | 🟠 Important | 5 unreachable page files with no routes | `App.tsx` |
| 10 | 🟡 Minor | `About.tsx` component named `Story` | `About.tsx` |
| 11 | 🟡 Minor | No SPA catch-all in vercel.json | `vercel.json` |
| 12 | 🟡 Minor | Admin Settings tab shows placeholder | `Admin.tsx` |
| 13 | 🟡 Minor | No mid-page CTA on About/Story page | `About.tsx` |
| 14 | 🟡 Minor | Privacy/Terms always show today's date | `Privacy.tsx`, `Terms.tsx` |
| 15 | 🟡 Minor | Hero image has no accessibility alt text | `Home.tsx` |
