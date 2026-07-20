# Incident — husk `generated_data/` destroyed, 2026-07-20

Moved here from husk `docs/` for posterity; husk itself has been cleaned of the crash
narrative. Written by the session that caused it.

## What was lost

`generated_data/` in its entirety — ~18 run folders: the frozen registration bench
(three pinned 2026-07-15 runs, `params.json` + `raw.glb` each) and the ~15 spike folders
from 2026-07-16 behind husk's `docs/recipes.md`. One file survived via the Synology
recycle bin. Cost: ~$5 of Fal spend and a day of spike work; the written findings
survive, their supporting images and meshes do not.

## Mechanism

A codex worktree carried symlinks to the parent checkout's gitignored `node_modules` and
`generated_data` (the convention of the time). `git add -A` in that worktree staged the
links — a `.gitignore` entry with a trailing slash (`generated_data/`) matches
directories only, never symlinks. Fast-forwarding `main` onto the branch then
materialised the links over the real directories; git deleted the originals to place
them. NFS deletes bypass the recycle bin and `/volume2/dev` had no snapshots.
Orchestrator error (Opus session), not codex's — codex's work was finished and verified
before the damage.

## What it changed

- **The hoard convention** (dev workspace `CLAUDE.md`): irreplaceable data lives in
  `hoard/` — a nested repo with a local mirror remote, never GitHub; gitignore hides
  regenerable junk only. Nothing valuable is ever merely ignored.
- **The codex rework** (`absol-codex_wip`): containment choreography (worktrees +
  symlinks + merges) replaced by codex working the real checkout on the commit gate;
  orchestrator git reduced to status/diff/commit.
- **Husk BUG-012**: the frozen bench is retired (old hand-scores incomparable, data not
  worth re-pinning); a later pass builds new test data into the tracked `hoard/`.

## The durable lesson

The data was irreplaceable, paid for, sitting in exactly one copy, inside a git working
tree, ignored so nothing watched it. Every safety mechanism in place covered tracked
files; the one thing outside the gate was the one thing that mattered. Rules that depend
on the operating model's intelligence are not safety mechanisms.
