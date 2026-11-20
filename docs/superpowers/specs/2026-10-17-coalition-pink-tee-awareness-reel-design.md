# Coalition Pink Tee October Awareness Reel — Design Spec

**Status:** Creative direction approved; waiting for user review of this written spec before implementation.

## Goal

Prepare a separate, editable Instagram Reel promoting Coalition’s women’s pink-silver leopard-print crop tee while expressing solidarity during October Breast Cancer Awareness Month. Preserve the already-published Parts reel and make no donation, charity-partnership, or fundraising claims.

## Audience and message

For women who support Coalition and the October awareness theme. The emotional message is solidarity, not medical advice or a fundraising appeal:

> This October, we stand with every woman and family impacted by breast cancer.

## Visual direction

Maker-led, using the supplied sewing photo as the opening human moment, followed by accurate product artwork for the tee’s front and back. Keep the existing Pink / Silver campaign’s black, rose-pink, and chrome identity; use restrained, readable typography and transitions. Do not imply that the sewing photo depicts this particular tee being sewn unless the image itself supports that claim. Do not imply an on-model fit; no matching on-model photo was supplied.

## Sequence and on-screen copy

Vertical 9:16, 1080 × 1920, 30 fps, target duration 14.6 seconds.

| Reel time | Visual | Text / purpose |
|---|---|---|
| 0.0–2.4 s | Supplied maker-at-sewing-machine photo | `PINK / SILVER` · `OCTOBER — BREAST CANCER AWARENESS MONTH` |
| 2.4–5.4 s | Pink leopard tee front | Product hero; preserve the accurate print and silver Coalition lettering |
| 5.4–7.4 s | Tee back | Highlight the `TRUST YOURSELF` silver puff artwork |
| 7.4–11.4 s | Return to maker photo or a calm product/maker composition | `This October, we stand with every woman and family impacted by breast cancer.` |
| 11.4–14.6 s | Product-led closing screen | `WOMEN’S LEOPARD PRINT CROP T-SHIRT` · `$45` · `S–XL` · `linktr.ee/sgcoalition` · `Trust Yourself.` |

The `1 of 12` / scarcity line is intentionally omitted. Do not add a donation percentage, beneficiary, medical efficacy claim, awareness ribbon emblem, or cause partnership unless separately supplied and approved.

## Inputs

- Maker photo: `public/images/pink-silver-making-process.png` (the supplied image is also present in the project).
- Tee front: `public/images/pink-silver-crop-top-front.png`.
- Tee back: `public/images/pink-silver-crop-top-back.png`.
- Existing brand reference and optional reusable media: `docs/logo-reveal/reel-pink/` and `docs/instagram-pink-silver-concept.md`.
- CTA details selected by the user: $45, S–XL, shop URL; no scarcity claim.

## Deliverables and acceptance criteria

Create a new HyperFrames project in `docs/logo-reveal/reel-pink-october-awareness/`; do not edit or replace the existing pink reel, the already-posted Parts reel, or shared product assets.

- Editable composition: `docs/logo-reveal/reel-pink-october-awareness/index.html` with project-local referenced media and project metadata.
- Review render: `docs/logo-reveal/reel-pink-october-awareness/renders/reel-pink-october-awareness.mp4`.
- Frame/contact-sheet review artifacts in that new project’s `renders/` directory.
- Caption draft saved beside the project as `docs/logo-reveal/reel-pink-october-awareness/SOCIAL-COPY.md`; draft only, not published.
- Render is H.264 MP4, 1080 × 1920, 30 fps, approximately 14.6 seconds; all supplied assets resolve in the render.
- Inspect representative extracted frames to verify readable on-screen copy, actual front/back product art, and correct CTA. Check the complete timeline with HyperFrames and probe the final MP4 metadata.
- No Instagram posting, deployment, or git commit is part of this work.

## Review and implementation boundary

The concept has been approved in chat. This written spec must be reviewed by the user before implementation begins. After approval, create the implementation plan and proceed only with the new project paths above; keep the existing reels untouched.
