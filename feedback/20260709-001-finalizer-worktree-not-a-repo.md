# Finalizer skips the post-run commit in git worktrees — "Not a git repo"

- date: 2026-07-09 · project: zei · run: RUN-2026-07-09
- component: finalizer

## What happened
Closing a scratchpad run in `projects/zei-dev` — a git *worktree* (snowowl two-worktree
pattern), where `.git` is a gitdir pointer file, not a directory — the finalizer reported
"Not a git repo — skipping the post-run commit." Everything else closed fine (archive
appended, ledger folded, state.md rewritten, run.md deleted), but the closure had to be
committed manually afterwards. Its repo check apparently tests for a `.git` directory
instead of asking git.

## Expected
Worktrees are a documented workspace convention (zei, snowowl). The check should be
`git rev-parse --is-inside-work-tree` (or equivalent), so the post-run commit lands in
worktree checkouts too.
