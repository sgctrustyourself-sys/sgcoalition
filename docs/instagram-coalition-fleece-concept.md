# Instagram Drop Concept — COALITION FLEECE

**Piece:** Coalition Fleece Hoodie · **$100** · **Run:** 1 of 15 · **Sizes:** S–2XL
**Target post date:** Monday, September 28 (your September 27 slot is already taken)

---

## Why this drop, and why built this way

The PINK / SILVER crop tee is already live. COALITION FLEECE is the next release in the
registry and it is the only queued drop that has real photography on disk.

**The constraint that shaped the whole carousel:** this drop has exactly one product
photograph — `public/images/Coalition-hoodie-front.png`, a washed black hoodie with orange
metal-band lettering across the chest. The registry's own front/back pointers
(`coalition-fleece-hoodie-{front,back}.png`) do not resolve to files, so
`npm run drop:render` cannot build this carousel and no back shot exists.

Every slide here is therefore a crop or a reframe of that one real photo. Nothing in the
carousel implies a back view, and there is no on-model slide — the fit of this garment has
not been shown to us, so we do not pretend it has.

## Creative direction — Y2K: orange on black

The chrome-Y2K system from the pink tee carousel, re-keyed to the garment: near-black
canvas, orange glow lifted from the lettering, chrome type, starbursts, sticker chips and
a halftone dot grid. The hoodie sits on a cream card so the black garment separates from
the black ground.

## Feed carousel order

1080 × 1350, post in this sequence:

1. **Cover** — chrome `COALITION` / `FLEECE`, $100, 1 of 15.
2. **Detail study** — "Orange on black." Tight crop on the chest graphic.
3. **One run only** — 1 OF 15, no reprints, $100, S–2XL.
4. **The belief** — hood-and-fleece crop, "TRUST YOURSELF. Coalition is action. Show up."
5. **Shop the drop** — price, sizes, sgcoalition.xyz/shop.

**Files**

- Slides: `docs/grid-reveal/y2k-fleece-slide-{1..5}.png`
- Review sheet: `docs/y2k-fleece-carousel-review.html`
- Re-render: `npx tsx scripts/render-coalition-fleece-y2k.ts`

---

## Feed caption — recommended

The post that just went up ran short and declarative. Match that register:

```text
Different weight. Same vision. 🖤
Coalition Fleece Hoodie.
Trust Yourself.
#SGCOALITION #TRUSTYOURSELF #COALITIONARCHIVE #STREETWEAR
```

Longer, in the standard house format:

```text
COALITION FLEECE.

Coalition Fleece Hoodie — $100.

Washed black. Orange metal across the chest. Built to look better worn in. Finished in-house. 1 of 15 in this run, sized S–2XL.

When it's gone, it's gone. Trust Yourself.

🔗 Link in bio → sgcoalition.xyz/shop

#Coalition #CoalitionFleece #BaltimoreStreetwear #TrustYourself #LimitedEdition
```

Both are now in the registry (`copy.igCaptionShort` / `copy.igCaptionLong`).

---

## Copy claims removed — please confirm

The previous registry copy made three claims the single photograph cannot support. I pulled
all three. Tell me if any is actually true and I will put it back:

| Removed claim | Why |
|---|---|
| "Midweight fleece" / "brushed interior" | We cannot see or feel the inside. Nothing in the photo establishes the fabric weight or the lining. |
| "A cut that holds its shape" | A garment-photo assertion, not something the image demonstrates. |
| "Our mark across the chest — nothing on the back" | A claim about the back of a garment we have no back photo of. |

Also rewritten: the X thread's "Winter weight without the bulk" line. Weight is a
construction claim; it went with the rest.

What the copy asserts now is only what the photo shows: washed black, orange metal
lettering across the chest, built to look better worn in, 1 of 15, $100, S–2XL.

---

## Publish checks — yours, not mine

- [ ] Confirm **$100** is the real price and **S–2XL** is the real size run.
- [ ] Confirm the PDP is live and the bio link resolves to it.
- [ ] Confirm the drop date/time if you want a Story countdown sticker.
- [ ] Add link / mention / countdown stickers **in-app**. They are never baked into the PNGs.
- [ ] Decide whether to post as a carousel (5 slides) or lead with slide 1 alone.

Nothing has been published, listed, or upserted.

## One known gap

`above-as-below-thermal` has **no product photography at all** — no front, no back. The
only Above as Below images in the repo are the tee, the set, and the shorts. The registry
test currently passes only because all three September 17 drops share `drop-2026-09-17` as
the newest group, and that test skips the newest group ("still being photographed"). The
moment the thermal gets its own drop group, `tests/dropRegistry.test.ts` will start failing
on it. Get a thermal photo shot before it goes near a release date.
