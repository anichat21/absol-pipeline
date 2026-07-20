# Codex worktree symlink convention destroyed the data it pointed at

- date: 2026-07-20 · project: husk · run: n/a (direct codex dispatch, not a pipeline run)
- component: git flow / codex worktree convention

## What happened
Set up a codex worktree and symlinked `node_modules` and `generated_data` into it, per
husk's own CLAUDE.md convention ("symlink the gitignored `generated_data/` ... and
`node_modules` in before verifying"). Later ran `git add -A` in that worktree to commit a
one-file fix. husk's `.gitignore` lists `node_modules/` and `generated_data/` **with
trailing slashes** — those patterns match directories only, never symlinks — so `git add -A`
staged both symlinks with no warning. Fast-forwarding `main` onto that branch then
materialised the symlinks over the real directories and git removed the originals.

`node_modules` was reinstallable. `generated_data` was not: NFS deletes bypass the Synology
recycle bin and `/volume2/dev` carries no snapshots. Lost the three pinned frozen-bench run
folders (SCR.4) and ~15 spike run folders backing `docs/recipes.md` and INBOX-032. Filed as
husk BUG-012.

## Expected
The worktree symlink convention must not be able to destroy the checkout it points at.

Fix ideas (mine, not the owner's): gitignore entries for symlinked paths have to be
slash-free to match the link itself; the worktree convention needs a teardown step that
removes the symlinks before any commit; and never `git add -A` in a worktree carrying
symlinks back into the parent checkout — stage explicit paths.
