# Norms that made three huntrx runs land clean (24, 13, 34 tasks; 0 terminal failures)

- date: 2026-08-03 · project: huntrx · run: RUN-2026-08-02, RUN-2026-08-02-2, RUN-2026-08-03
- component: orchestrate, planner, reviewer (whole-diff seam review), absol-codex

Cross-referenced against transcripts (`~/.claude/projects/-mnt-nas-dev/c63fb975-*` =
RUN-2026-08-02-2, `.../e0f4ab8c-*` = RUN-2026-08-03) plus the `.absol/archive/2026-08.md`
outcome blocks. Excludes RUN-2026-08-02-3 (the chaotic 38-task/13h27m run) — covered
separately.

## Norms that worked

- **Plan → independent judge → execute gate, every time.** RUN-08-02/02-2 had codex draft
  each plan, then a *fresh* general-purpose (Opus) subagent judged it before any code
  existed — 16 findings/7 plans (08-02), ~25 amendments/3 plans (08-02-2). Two of those
  amendments would have been mid-run hard failures: a planned `+page.test.ts` filename
  collides with SvelteKit's reserved name, and jsdom had no `matchMedia` shim before any
  route-mount test ran. RUN-08-03 got the same effect natively — `absol-planner` batched
  related small items into one plan call (BUG-042+BUG-049 together, INBOX-102+BUG-043
  together) rather than one call per item.
- **Whole-diff seam review as a standing final gate, not a per-task step.** All three runs
  ran one review over the entire diff after every task passed individually, and it found
  something real every time: FK-ordering + orphaned-PDF + unrecoverable-archive defects
  (08-02, 3 findings, fixed+reapproved), an empty-vs-stale branch ordering bug (08-02-2, 1
  finding, fixed+reapproved), a stale co-located test after BUG-046.1 moved logic
  server-side (08-03, 1 finding, fixed). Per-task review structurally cannot see these —
  each executor only sees its own files.
- **Retry loop always re-verifies before shipping.** Every fix-required verdict in these
  three runs got exactly one retry, re-verified, then reapproved — never "close enough."
  6 retries total across 08-02/02-2/08-03, 0 terminal failures.
- **Human-oracle honesty.** Every `verify_oracle: human` task recorded
  `skipped (needs-human-smoke)` and minted a fresh INBOX item rather than being marked
  pass — 4 owed items (08-02), 6 (08-02-2), 6 (08-03). Never faked.
- **Scope cuts over silent ADR violations.** BUG-046 (08-02) had 2 of 6 sub-fixes cut at
  plan time because they contradicted ACCEPTED ADRs 0014/0015 — left on the ledger with an
  `open:` line instead of building the wrong thing or unilaterally overruling. INBOX-089
  (08-02-2) cut 8→6 tasks, deferred tail filed as INBOX-102 with the untouched surfaces
  named explicitly.
- **Two valid execution engines, both zero-failure.** 08-02/02-2 delegated planning,
  execution batches, retries, *and* the seam review itself to codex via
  `ask.sh -b -e <effort>` (backgrounded, polled with `while kill -0 $PID; do sleep 20; done`)
  — plan/execute at effort medium, retry/seam-review at effort high. 08-03 (Opus
  orchestrator) instead ran everything as native Claude subagents — `absol-executor` in
  batches of 1–5 related tasks (10 calls for 34 tasks), `absol-reviewer` for the seam review
  (~7 min, Bash+Read only, no codex). Both hit 0 terminal failures — codex-delegation isn't
  load-bearing for correctness.
- **Token/task ratio**: RUN-08-03 logged per-batch tokens explicitly — 1069K tok / 34 tasks
  ≈ 31K/task, with single-task batches around 60–140K and 4–5-task mechanical batches
  40–160K total (i.e. batching amortizes, doesn't multiply).

## Friction (small, still worth fixing)

- **Execution never parallelizes across independent items, even though planning does.**
  08-02-2 ran 3 codex plan processes concurrently in the background for 3 unrelated items;
  every execution batch in all three runs — codex or native — ran serially, including
  across items that touch disjoint files (e.g. BUG-042 and BUG-049 in 08-03 share nothing).
  Wall-clock (2h49m–2h52m for ~24–34 tasks) is dominated by this seriality.
- **Per-task review's boundary misses "far" consumers.** BUG-046.1 (08-03) moved merchant
  filtering server-side and orphaned a co-located dashboard test still mocking the deleted
  fetch; only the whole-diff seam review caught it, not the task's own review pass.
- **Component/unit tests plateau before real DOM interaction bugs.** BUG-049 (08-03)
  shipped a correct fix (component + backend tests green) but could not reproduce the
  actual on-device Save→revert headlessly; the deeper suspect (a portalled Select tripping
  the ResponsiveOverlay outside-click detector) stays SUSPECTED, carried on INBOX-118. The
  gate correctly declined to claim closure, but there's no rung between "unit-tested" and
  "human smoke" for this class of nested-overlay race.
