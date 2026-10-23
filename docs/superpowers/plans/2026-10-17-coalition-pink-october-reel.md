# Coalition Pink Tee October Awareness Reel Implementation Plan

> **For agentic workers:** Execute tasks in order; do not commit unless the user requests it. Render only for review, never publish or post.

**Goal:** Deliver a new editable 14.6-second vertical HyperFrames reel and a verified review MP4, without modifying the posted Parts reel or existing pink-silver reel.

**Architecture:** Scaffold a separate HyperFrames project at `docs/logo-reveal/reel-pink-october-awareness/`, copy only the approved local photos, existing branded still artwork, and existing 14.6-second campaign music needed by the new composition. Author one seek-safe GSAP timeline in `index.html`; render to the exact named MP4, extract representative frames/contact sheet, and provide an Instagram caption draft.

**Tech Stack:** HyperFrames CLI 0.8.168, HTML/CSS, GSAP browser global, local raster assets, FFmpeg/ffprobe.

## Global Constraints

- Canvas 1080 × 1920, 30 fps, 14.6 seconds.
- Exact solidarity line: “This October, we stand with every woman and family impacted by breast cancer.”
- Show $45, S–XL, and `sgcoalition-five.vercel.app`; omit “1 of 12”.
- No donation, beneficiary, medical efficacy, charity-partnership, or fundraising claim.
- Leave `docs/logo-reveal/reel-pink/`, the posted Parts reel, and shared `public/images/` untouched.
- Do not publish or post; no git commit.
- Do not render until the user has approved the design/spec; this approval is recorded in the conversation.

## Files

- Create `docs/logo-reveal/reel-pink-october-awareness/index.html`: standalone composition and one paused, registered, deterministic GSAP timeline.
- Create `docs/logo-reveal/reel-pink-october-awareness/hyperframes.json`, package metadata, and a project-local `assets/` folder through HyperFrames scaffold; update its CLI pin only if scaffold already selects current CLI.
- Copy maker, tee front/back, existing campaign identity artwork/texture as needed, and existing 14.6-second instrumental bed into the new project’s `assets/`.
- Create `docs/logo-reveal/reel-pink-october-awareness/SOCIAL-COPY.md`: draft caption and a note that awareness framing is solidarity only.
- Render `docs/logo-reveal/reel-pink-october-awareness/renders/reel-pink-october-awareness.mp4`.
- Create `docs/logo-reveal/reel-pink-october-awareness/renders/contact-sheet.jpg` and representative extracted review frames.

### Task 1: Scaffold and isolate the project

- [ ] Initialize a new portrait project with HyperFrames 0.8.168 at the exact new project path.
- [ ] Confirm no pre-existing directory will be overwritten; keep all current in-progress user files untouched.
- [ ] Copy the approved maker/product art and existing instrumental bed into project-local assets.
- [ ] Start HyperFrames project history for the new project and end it after all project writes.
- [ ] Verify asset dimensions, filenames, and music duration (14.6 s) with Pillow/ffprobe.

### Task 2: Author composition and copy

- [ ] Write a deterministic composition with maker opening, product front, product back, solidarity beat, and CTA close matching the approved time map.
- [ ] Use local font fallbacks or a bundled, licensed typeface; do not rely on unpinned remote fonts.
- [ ] Keep text within the vertical safe area and verify contrast at check sample times.
- [ ] Reuse the existing instrumental only if its 14.6-second length and mix remain appropriate; otherwise leave the reel silent rather than inventing unapproved audio.
- [ ] Create `SOCIAL-COPY.md` based on the existing product caption, adapt it to October solidarity, and omit unsupported scarcity/fundraising assertions.
- [ ] Run the CLI lint after the first HTML pass; fix findings at source.

### Task 3: Validate and preview composition

- [ ] Run `npx --yes hyperframes@0.8.168 check --snapshots --strict` in the new project.
- [ ] Inspect check snapshots for the maker, front/back product artwork, awareness copy, and CTA.
- [ ] Inspect the timeline JSON for the 14.6-second root, clip coverage, and audio duration.
- [ ] Start the HyperFrames Studio preview as a persistent process, verify HTTP 200, and show the project URL to the user.
- [ ] Pause for the user's final preview approval before encoding the MP4.

### Task 4: Render and verify after approval

- [ ] Render at 30 fps, quality `looks` to `renders/reel-pink-october-awareness.mp4`.
- [ ] Confirm render summary, file non-empty, MP4 H.264 dimensions/duration/fps/frames, and expected audio stream.
- [ ] Extract representative frames (at least opening, front, back, solidarity, final CTA) and assemble `contact-sheet.jpg`.
- [ ] Open/review the extracted frames to verify message legibility, visual truthfulness, and final CTA.
- [ ] Confirm the pre-existing reels and shared source product files were not changed.
- [ ] Leave Studio preview alive for iteration; do not publish or post.
