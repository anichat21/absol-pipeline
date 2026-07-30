# Session dissection: the codex-fleet experiment (RUN-2026-07-29-2, arctic-tern)

- date: 2026-07-30 · project: arctic-tern · run: RUN-2026-07-29-2
- component: codex skill / orchestration doctrine — owner requested this dissection for later autopsy

## What ran
13 codex sessions in one evening, all gpt-5.6-sol, zero quota pushback on the Plus window:
7 executors at medium effort (UI round ×5 items, Apps row, annotate-everywhere, KB condense,
batch-of-3, fix-batch ×18, smoke), 6 judgment sessions at high (KB audit + 5-reviewer fleet).
Every executor returned green tests and zero forced edits; shipped as arctic-tern 0.2.0.

## Validated (new evidence for model-doctrine)
- **Writer ∥ reader**: clean (already logged in 20260729-004).
- **Writer ∥ writer across different trees**: SCR.5 (arctic-tern) ran concurrently with
  SCR.6 (absol repo + knowledge_base) — no interference. 004's "untested" is now tested;
  the serial rule is per-checkout, not global.
- **5-way parallel reviewer fleet**: 26 findings, 24 accepted after adjudication, ~40 min
  wall-clock. The grouped-diff framing caught composition bugs per-task review cannot see
  (links tiles kept the legacy hover dialect; Apps hover occluded the shared watermark; SSE
  rerenders silently reset board filters). Distinct lenses > redundant generalists — overlap
  between the five reports was near zero (one duplicate: the HEAD-probe bug, R1+R4).
- **Reviewer quality on absol itself**: R5 caught the orchestrator's own gaps — `parked`
  documented but unenforced in the derived layer, and KB-condensation drift (loosest
  "primed" definition presented as truth). Reviewing the reviewer's employer works.
- **Effort split held at scale**: brief-at-medium executed 18 adjudicated fixes with zero
  flags; high was worth it only for audit/condense/review work.

## What broke / lessons
- **Schema-contract gap in brief prep**: the Apps brief declared portfolio `prod_url`/
  `dev_url` as "decided" but the toolset rejected the fields (PORTFOLIO_FIELDS allowlist);
  same wall again later with `type`. Lesson: when a brief invents a data contract, verify
  the write path accepts it BEFORE dispatch — a `--help`/schema check is one command.
- **AGENTS.md vs reviewers**: the standing "no git" line blocks the `git diff` reviewers
  need; each review brief had to carry an explicit read-only-git override. Consider a
  reviewer variant in the codex skill so this is standard, not per-brief boilerplate.
- **Smoke found what review never would**: container DNS (`aidev` unresolvable inside
  docker) made the app mark itself down — invisible to all five reviewers and 55 green
  tests, caught only by smoking the real artifact. The smoke-the-image step earns its keep;
  it cost zero codex fix passes (config fix, verified by re-running the failed check).
- **Token accounting owed**: task-usage events say see-codex-rollout; per-session totals
  were never pulled from ~/.codex/sessions rollouts. If the owner wants the spend curve,
  match rollouts to lanes by start timestamp.

## Suggested folds (owner to ratify)
1. absol-codex: state the parallel rule as "one writer per checkout; readers unlimited" and
   add the reviewer-fleet pattern (grouped diff, distinct lenses, adjudicate-then-one-fix-batch)
   as a named play.
2. Brief-authoring: add the schema-contract preflight to the briefing rules.
3. Consider the capped ladder used here (review fleet → fix batch → smoke → 1 solve pass →
   1 small pass → file the rest) as the default AFK closing sequence for build-heavy runs —
   it terminated cleanly and every cap held.
