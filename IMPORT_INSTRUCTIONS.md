# Brand Guidelines — Import Instructions

## 📝 Notion Import

### Option 1: Direct Markdown Import (Easiest)
1. Open Notion → New Page → **Import** → **Markdown**
2. Select `BRAND_GUIDELINES.md` from repo root
3. Notion will auto-convert headers, tables, code blocks
4. **Fix needed:** Gradient tables won't render — manually recreate those 2 tables in Notion

### Option 2: Structured Database (Better for Teams)
1. Create Notion database: **Brand Guidelines**
2. Properties: Section, Subsection, Property, Value, Notes, Status
2. Copy/paste each section as separate pages
3. Use **Synced Blocks** for tokens used across pages

### Notion Page Structure
```
Brand Guidelines (Page)
├── 1. Brand Essence
├── 2. Visual Identity
│   ├── 2.1 Color Palette (Table view)
│   ├── 2.2 Typography
│   ├── 2.3 Glassmorphism
│   ├── 2.4 Motion
│   ├── 2.5 Iconography
│   └── 2.6 Imagery
├── 3. Voice & Tone
├── 4. Component Library
├── 5. Page Templates
├── 6. Crypto/Web3
├── 7. WPOL Milestones
├── 8. Accessibility
├── 9. Responsive
├── 10. Performance
├── 11. Assets
└── 12. Governance
```

### Quick Setup Script (Notion API)
```bash
# If you have Notion integration token
npm install @notionhq/client
node scripts/sync-to-notion.js  # See scripts/sync-to-notion.js
```

---

## 🎨 Figma Import

### Option 1: Figma Tokens Plugin (Recommended)

1. **Install Plugin:** Figma → Plugins → Search "Figma Tokens" → Install
2. **Import JSON:**
   - Open plugin → Settings (gear) → **Import Tokens**
   - Select `figma-tokens.json` from repo root
   - Choose **"Replace all tokens"**
3. **Apply to Styles:**
   - Plugin → **Create Styles** → Creates Color, Text, Effect, Grid styles
   - Or manually: Right-click token → **Create Style**

### Figma File Structure
```
Brand System (File)
├── 🎨 Color Styles
│   ├── Primary / Void Black
│   ├── Primary / Deep Void
│   ├── Accent / Arcane Purple
│   ├── Accent / Electric Blue
│   ├── Accent / Sunset Orange
│   ├── Accent / Emerald Green
│   ├── Accent / Blended
│   ├── Semantic / Text Primary
│   ├── Semantic / Text Muted
│   ├── Semantic / Border Subtle
│   ├── Semantic / Border Accent
│   ├── Status / Error
│   ├── Status / Warning
│   ├── Status / Success
│   └── Glass / Standard / Elevated / Purple / Orange / Blue
├── 📝 Text Styles
│   ├── Display / 1 / 2 / 3
│   ├── Headline / 1 / 2 / 3
│   ├── Body / LG / Base / SM
│   ├── Caption / SM
│   └── Label (uppercase, tracking-widest)
├── 📐 Effect Styles
│   ├── Shadow / SM / MD / LG / Glow / Glass / Glass Hover
│   └── Blur / 12px / 16px
├── 📏 Grid Styles
│   ├── Mobile (4px)
│   ├── Tablet (8px)
│   └── Desktop (8px)
├── 🔲 Component Variants
│   ├── Button / Primary / Secondary / Ghost / Destructive / Icon
│   ├── Card / Standard / Feature / Stat / Glass Panel
│   ├── Input / Default / Select / Label
│   └── Nav / Main / Active / Mobile
└── 📱 Breakpoint Frames
    ├── Mobile (375px)
    ├── Tablet (768px)
    ├── Desktop (1440px)
    └── Wide (1920px)
```

### Figma Tokens Sync (Advanced)
```bash
# Sync tokens from code → Figma
npm install @figma/rest-api-spec
node scripts/sync-figma-tokens.js  # Uses Figma REST API

# Or use Tokens Studio CLI
npx @tokens-studio/cli sync --token-set=brand --figma-file=YOUR_FILE_ID
```

---

## 🔄 Keep in Sync

### Automated Sync (Recommended)
```yaml
# .github/workflows/sync-brand.yml
name: Sync Brand Tokens
on:
  push:
    paths:
      - 'BRAND_GUIDELINES.md'
      - 'figma-tokens.json'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync to Figma
        run: npx @tokens-studio/cli sync
        env:
          FIGMA_TOKEN: ${{ secrets.FIGMA_TOKEN }}
      - name: Sync to Notion
        run: node scripts/sync-to-notion.js
        env:
          NOTION_TOKEN: ${{ secrets.NOTION_TOKEN }}
```

---

## 📋 Quick Checklist

- [ ] **Notion:** Import `BRAND_GUIDELINES.md` → Fix gradient tables
- [ ] **Figma:** Import `figma-tokens.json` via plugin → Create styles
- [ ] **Team:** Share Notion page + Figma file with edit access
- [ ] **CI:** Add sync workflow for future updates

---

## 🔗 Quick Links

| Asset | Location |
|-------|----------|
| **Markdown Source** | `BRAND_GUIDELINES.md` (repo root) |
| **Figma Tokens JSON** | `figma-tokens.json` (repo root) |
| **Figma Plugin** | [Figma Tokens](https://www.figma.com/community/plugin/843461159747178978) |
| **Tokens Studio** | [tokens.studio](https://tokens.studio/) |

---

*Generated from BRAND_GUIDELINES.md v1.0*