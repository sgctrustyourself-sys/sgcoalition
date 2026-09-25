# Repository Recovery — OneDrive → non-synced path

This document explains how the SGCoalition repository was moved out of OneDrive, why, and the exact procedure to re-clone the repo + re-register the 6 Codex sub-agent worktrees if it ever needs to be done again.

> Last incident: **2026-07-11**. Total recovery time: ~30 min. Recovery artifacts (patches + bundles + raw `.git` tarball) saved in `/tmp/saved-commits/` on the operator's machine — operator-local, **not** in the repo.

---

## Why we moved out of OneDrive

The repository was previously at `C:/Users/SG/OneDrive/WebApps/SGCoalition`. OneDrive's background file sync was corrupting git's pack files mid-write, causing:

- `git gc --auto` to fail with `fatal: unable to read <sha>` + `error: failed to perform geometric repack` + `error: task 'geometric-repack' failed`
- `git commit` and `git fetch` to randomly fail with the same error
- The bad SHA to be **unreachable** via any normal check — not in any pack idx, not loose, not in any for-each-ref (branches, tags, or worktree HEADs). Only the mmap'd pack state held the dangling reference.

Three standard fixes were tried and **all failed**:

1. `git reflog expire --all --expire=now && git gc --prune=now` — failed
2. `git gc --aggressive` — failed
3. `git worktree prune` + manual removal of **21 stale `.git/worktrees/SGCoalition*` admin dirs** — fixed the stale-worktree noise but did not fix the underlying pack corruption

The cure: re-clone the repo to a path OneDrive is **not** syncing. The canonical path is now `C:/Users/SG/WebApps/SGCoalition` — same `WebApps/SGCoalition` folder structure as the OneDrive layout, so bookmarks, IDE workspace settings, and scripts that referenced the old path need only a one-shot find-and-replace of the prefix.

---

## Where the repo lives now

**Canonical local path:** `C:/Users/SG/WebApps/SGCoalition`

| Asset | Path |
| --- | --- |
| Repo working tree | `C:/Users/SG/WebApps/SGCoalition/` |
| `.git` directory | `C:/Users/SG/WebApps/SGCoalition/.git/` |
| Codex worktrees | `C:/Users/SG/.codex/worktrees/{16aa,6ac7,c447,cf32,d4ac,e86d}/SGCoalition` |
| Recovery artifacts (operator-local) | `/tmp/saved-commits/` on the operator's machine |
| Old broken repo (untouched) | `C:/Users/SG/OneDrive/WebApps/SGCoalition/` — leave alone until confident the new path is healthy |

The `.codex` worktrees are intentionally re-registered as **detached HEADs** at the original SHAs (`2d1ba9b` ×5, `658ed32` ×1). They are NOT branches — they are tool state from prior sub-agent runs that the operator may want to resume.

---

## Recovery procedure (re-clone from origin)

This is the exact sequence that worked on 2026-07-11. Time budget: ~30 min.

### Phase 0 — Save everything (read-only, safe)

```bash
cd "C:/Users/SG/OneDrive/WebApps/SGCoalition"

# Disable auto-gc FIRST so background repack doesn't block read-only ops
git config gc.auto 0

# 30 unpushed master commits via format-patch (defense in depth)
git format-patch -o /tmp/saved-commits/ origin/master..master

# 3 unpushed feat/instant-loading-screen commits (often test/diagnostic — verify before keeping)
git format-patch -o /tmp/saved-commits/ origin/feat/instant-loading-screen..feat/instant-loading-screen

# Targeted bundles (preserves SHAs — better than format-patch for this purpose)
git bundle create /tmp/saved-commits/master.bundle origin/master..master
git bundle create /tmp/saved-commits/feat.bundle origin/feat/instant-loading-screen..feat/instant-loading-screen

# Nuclear fallback: raw .git tarball
tar -czf /tmp/saved-commits/dot-git-raw-backup.tar.gz .git
```

If `git format-patch` succeeds for all 33 commits, the bad SHA is **not** in the 33-commit graph. If it fails mid-way, the offending commit is in the failing range — note its SHA for manual recovery from the raw tarball.

> **Note on durability:** `/tmp` is not persistent on this Windows / Git Bash setup (cleared on reboot or disk cleanup). Move `/tmp/saved-commits/` to a durable location (e.g. `~/Documents/repo-recovery-2026-07-11/`) before rebooting. The raw `.git` tarball is the most durable artifact — patches + bundles are the convenient ones.

### Phase 1 — Re-clone to the non-OneDrive path

```bash
git clone https://github.com/sgctrustyourself-sys/sgcoalition.git C:/Users/SG/WebApps/SGCoalition
cd C:/Users/SG/WebApps/SGCoalition
```

### Phase 2 — Restore user identity (the new clone has no local user config)

```bash
old_name=$(git -C /c/Users/SG/OneDrive/WebApps/SGCoalition config --get user.name 2>/dev/null)
old_email=$(git -C /c/Users/SG/OneDrive/WebApps/SGCoalition config --get user.email 2>/dev/null)
[ -n "$old_name" ]  && git config user.name "$old_name"
[ -n "$old_email" ] && git config user.email "$old_email"
```

### Phase 3 — Check out the feature branch FIRST, then fetch master (avoids the "refusing to fetch into current branch" lock)

```bash
git checkout origin/feat/instant-loading-screen -B feat/instant-loading-screen
git fetch /tmp/saved-commits/master.bundle master:master
```

The `git fetch <bundle> master:master` syntax **preserves the original SHAs**, so the 6 Codex worktree SHAs (`2d1ba9b` ×5, `658ed32` ×1) still resolve in the new repo. `git am` would have created new SHAs and forced you to re-identify branch tips by commit subject — slower and error-prone.

### Phase 4 — Verify the 6 worktree SHAs are reachable

```bash
for sha in 2d1ba9bf4edd5aab7474d546e70ec98af35df679 658ed32f114a880e9c7a6b6c422fe29803eeb86d; do
  git cat-file -e "$sha" 2>/dev/null && echo "OK: $sha" || echo "MISSING: $sha"
done
```

If a SHA is missing, fetch it directly from the old repo (assumes the object isn't in the corrupt pack):

```bash
git fetch /c/Users/SG/OneDrive/WebApps/SGCoalition/.git <missing-sha>
```

### Phase 5 — Re-register the 6 Codex worktrees (swap strategy)

For each of `C:/Users/SG/.codex/worktrees/{16aa,6ac7,c447,cf32,d4ac,e86d}/SGCoalition`:

```bash
id="<id>"             # 16aa, 6ac7, c447, cf32, d4ac, or e86d
commit="<sha>"        # 2d1ba9b for 5 of them, 658ed32 for d4ac

wdir="/c/Users/SG/.codex/worktrees/${id}/SGCoalition"
bdir="${wdir}_bak"

mv "$wdir" "$bdir"
git -C /c/Users/SG/WebApps/SGCoalition worktree add -d "$wdir" "$commit"
cp "$wdir/.git" "$bdir/.git"
rm -rf "$wdir"
mv "$bdir" "$wdir"
```

End state per worktree: original source code (any uncommitted state preserved) + valid `.git` pointer to the new repo's admin dir. The new worktree's HEAD is the commit SHA you passed to `git worktree add`.

### Phase 6 — Verify

```bash
git worktree list        # should show 7: main + 6 .codex
git gc --auto            # should run clean — no geometric-repack error
git fetch origin         # should work without errors
git status               # should be clean (any pre-recovery uncommitted state was lost — it was in the corrupted .git)
git log -3 --oneline master
git log -3 --oneline feat/instant-loading-screen
```

---

## Hard rules going forward

1. **Never put the repo in a OneDrive-synced folder again.** Background sync of pack files is the root cause of the corruption. If you must use a synced drive, exclude `.git/` from sync.
2. **Run `git worktree prune` periodically** to prevent stale `.git/worktrees/SGCoalition*` admin dirs from accumulating. The original failure on 2026-07-11 had 21 stale worktree admin dirs from months-old sub-agent runs; the geometric-repack error was the symptom, not the cause.
3. **Use bundles over format-patch when migrating commits** between broken-and-healthy repos. Bundles preserve SHAs; format-patch creates new SHAs via `git am` and forces you to re-identify branch tips by commit subject.
4. **Save the raw `.git` tarball as nuclear fallback** even after bundle + format-patch. It costs nothing and has saved us once already.
5. **When re-registering the 6 Codex worktrees via Phase 5, do NOT `git checkout -b` them.** They must stay detached HEADs at the original SHAs (`2d1ba9b` ×5, `658ed32` ×1) — they are tool state, not work-in-progress branches.

---

## If it ever happens again

1. **Check `git worktree list` first.** Stale worktree admin dirs are the most common cause of geometric-repack errors and are a 30-second fix via `git worktree prune --expire=now`.
2. **If prune doesn't fix it,** the corruption is in pack internals. Don't try to repair in place — re-clone.
3. **Use the Phase 0-6 sequence above.** The whole flow is ~30 min including the worktree re-registration.
4. **Check the live server after recovery** with the curl matrix in the README's "Live server state — 2026-07-11 health check" section. The new repo should produce the same live state as the old one.

---

## What this doc does NOT cover

- **The 4 live-server 404s** (see [Backend Bug-Fix Checklist](../README.md#backend-bug-fix-checklist)) (`/api/marketing-subscribe`, `/api/csp-report`, `/api/marketing-stats`, `/nojs.html`). These are a separate deploy regression, not related to the OneDrive corruption. Operator follow-up: clean redeploy from `master` with build cache off.
- **The 3 diagnostic test commits** on `feat/instant-loading-screen` from the 2026-07-11 debugging session. The Phase 3 `-B feat/instant-loading-screen` force-resets the local branch to `origin/feat/instant-loading-screen`, which discards those test commits by design. If you need them, fetch the `feat.bundle` from `/tmp/saved-commits/`.
