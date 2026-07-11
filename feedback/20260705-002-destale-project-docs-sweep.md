# Absol has no mechanism to check projects for stale docs and update them (incl. absol-owned git rules)

- date: 2026-07-05 · project: huntrx · run: RUN-2026-07-05 (post-run)
- component: front door / finalizer / migrate (or a new destale pass)

## What happened
Over this session, huntrx's docs had accumulated staleness that only got fixed because the user
noticed and told me to: CLAUDE.md still described the classification layer as `categories/ → rules
engine, AI categorization` (the codebase moved to `tags/ tag_groups/ tag_features/` — roadmap.md
even records "Category/CategoryRule no longer exist"); and it carried a "commit only when
explicitly asked" git rule that is now redundant because absol owns git flow (see
20260705-001). Nothing in absol proactively surfaces or fixes this — it fell on the user as manual
bookkeeping, which they were visibly frustrated by ("do I keep having to do stale bookkeeping?").

## Expected
Give absol a way to check a project and update stale docs — run it from the front door (a
staleness nudge in the banner), at finalize (already rewrites state.md; could also flag drifted
CLAUDE.md/vision/roadmap terminology against the actual code), extend `absol-migrate` beyond
schema to free-text docs, or add a dedicated `/absol-destale` pass. It should specifically:
- catch terminology/structure drift (doc says X, code says Y) and update or flag it;
- strip per-project rules that absol now owns centrally — starting with git-flow rules per the
  20260705-001 ruling (absol owns git flow; projects shouldn't carry their own).
Don't make the user be the staleness detector.
