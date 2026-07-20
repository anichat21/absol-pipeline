# Codex planner+executor lane: solid on a full pipeline task, but under-weights referenced artifacts vs inline brief text

- date: 2026-07-17 · project: husk · run: RUN-2026-07-17-4
- component: planner, executor (codex delegation lane)

## What happened

First full pipeline task on codex as both planner and executor (INBOX-038.1 segment-only
create path, 7 files, medium risk — a step up from the prior tidy-batch pilots).

Planner (gpt-5.6-sol, high): produced a single correctly-scoped vertical slice where
over-decomposition was the expected failure; acceptance criteria concrete/testable; extended
verification unprompted (docker-image GLB presence check). Miss: the research map handed to
it explicitly flagged the SEGMENT-vs-SegmentKey vocabulary collision as a hazard, and the
plan ignored it — orchestrator had to amend the task description.

Executor: all 7 files exactly in the assigned set; honest verification reporting (correctly
attributed 6 full-suite failures to gitignored fixtures missing from the worktree instead of
hiding or misdiagnosing them); handled the vocabulary disambiguation well once it was stated
inline in the brief; independently pinned the riskiest behavior change (shared `held`
early-return deletion) with tests before the reviewer asked.

Common thread across both legs: codex acts on inline brief text but under-weights artifacts
the brief only references (the map file's hazard list). The hazard was acted on only after
being restated inline.

## Expected

Referenced context (map files, ADRs named in the brief) treated with the same weight as
inline text. Until then: codex briefs must inline every hazard/constraint that matters —
"read the map at <path>" is not sufficient delivery for binding constraints.

## Fix ideas

Brief-template rule for the codex lane: hazards, refuse-lines, and binding vocabulary always
pasted into the brief body; file references reserved for background only. (Worked when done
this run — the amendment landed correctly.)

Also worth recording as lane evidence: brief-then-diff-review held at feature-slice scale;
containment (worktree + orchestrator diff-review + orchestrator-run verification) added no
friction; no token figures are available from `codex exec` for archive effort stamps.
