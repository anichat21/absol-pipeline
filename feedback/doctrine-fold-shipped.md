# Doctrine fold — shipped 2026-07-11

Six notes (20260705-001..003, 20260708-001, 20260709-001, 20260711-001) plus a live design
session folded into the skills as one change. The root cause across the behavioural notes was
single: absol treated everything written down as one kind of truth — policy (the user's own
rules for agents) got defended like fact, notes stacked instead of superseding, and silence
read as risk instead of pass.

What shipped:

1. **`references/doctrine.md`** (new, referenced by every skill/agent) — rules bind agents
   not the owner (rewrite on contact, one-line report, never quoted back); facts always
   surface in one line; silence is a pass signal; positive-rule writing style; absol owns git
   flow (trust `git rev-parse`, worktrees are repos); fix-don't-file effort allocation;
   `maturity: scaffold|stable` ceremony dial; draft-vs-ratified ADRs.
2. **Smoke ledger** — VERIFY items reframed as a quiet reference checklist; banner shows
   counts only; finalizer decays items ≥4 runs old with no related BUG as "presumed passed in
   use"; new releases supersede same-surface smokes. `tags: tuning` quiet lane joins it.
3. **Finalizer** — repo check via `git rev-parse --is-inside-work-tree` (worktree bug); post-
   run commit never surfaced as a rule conflict; smoke decay sweep.
4. **Note-taker** — items written as the owner would have typed them (no medium, no
   narration); enrich rewrites shape lines to current truth instead of stacking; big decisions
   get one home as a draft ADR.
5. **Planner** — the feature defines the shape (reshaping seams is plan work, not debt);
   acceptance criteria are user-walkable end-to-end; scaffold maturity flips the dial.
   Front door may propose a Fable planner in one line (y/n) for genuine system rework.
6. **Reviewer** — dead-end test: half-wired user flows are fix-required even with green units.
7. **Orchestrator** — close-out trivia sweep: fix small flagged things in-run; the ledger gets
   only big first-time observations.
8. **Architect** — sole ADR *ratifier* (scribe mode for conversation-landed decisions);
   scaffold graduation owns the "large system rework" ask. Megareview declines scaffold
   projects.
9. **Newproject** — Shipping & Git baseline conforms to absol-owns-git-flow; CONTEXT.md seeds
   `maturity: scaffold`; ADR template carries draft status.

Still owed (not shipped here): sweeping the stale "commit only when asked" git rules out of
existing project CLAUDE.mds (zei-dev, distillery — absol runs were live during the fold);
doctrine says the front door conforms them on contact, so they self-heal next session.
