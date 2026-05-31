---
name: absol-finalizer
description: "[INTERNAL] Closes an absol run (pipeline or scratchpad). Walks the event stream in run-active.md to reconstruct each task's final state, writes the durable archive/run-{run_id}.md, deletes run-active.md, clears the ## Active Run and ## Pause sections from state.md, removes done plans from plan.md, removes notes whose owning plan/scratchpad completed, updates state.md as a current-truth snapshot. Invoked by absol-orchestrate (pipeline runs) or absol-scratchpad (adhoc runs). Do NOT trigger directly except when the user explicitly says '/absol-finalizer'."
---

# absol-finalizer

Close a run. Reconstructs verified outcomes from the event stream, writes the durable archive, surfaces anything still needing the user's attention.

You handle two run shapes:

| Run shape | run_id prefix | Triggered by |
|---|---|---|
| **Pipeline** | `RUN-` | `absol-orchestrate` after Step 6 finalize |
| **Scratchpad** | `SCR-` | `absol-scratchpad` on close |

The shapes share the run-active.md format (`mode:` field distinguishes them), so most of your work is identical. Where it differs (plan.md handling), it's flagged.

## Layout

Assumes `.absol/`. If absent, fall back to root-level paths and append *"Layout: flat (legacy). Run `/absol-migrate` to upgrade."* to the final summary.

## Reads / writes

Reads: `.absol/run-active.md`, `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`, `state.md`.

Writes: `state.md`, `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`, `.absol/archive/`.

Deletes: `.absol/run-active.md` (after archiving).

Never writes: `vision.md`, `roadmap.md`, `CLAUDE.md`, `CONTEXT.md`, ADRs.

## Steps

### 1. Read and validate (idempotency-aware)

Read `run-active.md`. Verify the header (`run_id`, `mode`) matches state.md's `## Active Run` section. Mismatch → don't reconcile silently; tell the user, exit.

**Idempotency check.** Look for `archive/run-{run_id}.md`. If it already exists, you're finalizing a partially-completed prior finalize (likely a crash between archive-write and the cleanup steps). In that case:
- Don't re-write the archive file.
- Skip directly to Steps 4–9 (delete run-active.md, clear transient state, prune plan.md, etc.).
- Report this in Step 10 ("Resumed partial finalize of {run_id}").

If `run-active.md` is missing or has no events (besides the snapshot), nothing to reconcile — but still run Steps 5 onward (clear transient state, ensure plan/note hygiene). Don't write an empty archive file.

### 2. Reconcile per-task final state

Walk the `## Events` section in chronological order. For each task in the snapshot, derive its final state by event-folding:

| Latest event for task | Resulting status | Fields harvested |
|---|---|---|
| `task-completed` `status: done` (no review, or `review` `verdict: approved`) | done | files_touched_actual, summary, verification_result, review_flag |
| `task-completed` followed by `review` `verdict: fix-required` \| `human-check` \| `blocked` | needs-review | + review verdict, issues, fix_request — never silently mark done when a review is unresolved |
| `task-failed` (after >2 `task-retry`) | failed | files_touched_actual, blocker, retry_count |
| `task-blocked` | blocked | files_touched_actual, blocker |
| no terminal event | pending (ran out of run mid-task) | flag in summary |

Build the reconciled task table for the archive — each task entry gets the static fields PLUS the harvested run-time fields PLUS any review verdicts.

### 3. Archive the run

Write `.absol/archive/run-{run_id}.md` — the definitive, **outcome-only** record. Do NOT copy plan-time specs (description, acceptance_criteria, verification command, risk, predicted files_touched); those died with plan.md and aren't needed to know what happened. One line per task. Omit default-value fields (`review_flag: no`, `retries: 0`).

```
# {run_id} — {date}  ({pipeline | scratchpad}{, Crashed: yes})

{n} done · {n} failed · {n} blocked · {n} needs-review · {duration}
Plans: PLAN-001 "title" (done), PLAN-002 "title" (in-progress)    (omit for scratchpad)

## Tasks

- TSK-001 done — {one-line summary}. files: src/a.ts, src/a.test.ts. verify: pass.
- TSK-002 failed (×2) — {blocker}. files: src/cache.ts.
- TSK-003 needs-review — {fix_request}. files: src/x.ts. review(opus): fix-required.

## Notable                               (omit if none)
- {divergence, superseded plan, succeeded-after-retry, or anything the next run must know}
```

Per-task line: `id status[ (×retries)] — summary. files: <actual>.[ verify: <result>.][ review(<model>): <verdict>.]` — append `verify`/`review` only when present. No "Files modified" union; the per-task `files:` lists are enough. This is the only durable run history — keep it scannable, not a transcript.

### 4. Delete run-active.md

After successful archive write, delete the file. Pipeline state is reset; the project is no longer "active."

### 5. Clear ## Active Run and ## Pause from state.md

Remove both transient sections. The project is now in a clean state.

### 6. Update plan.md (pipeline runs only)

For each plan that ran this session, derive each of its tasks' final state from the events (Step 2 reconciliation already did this):

- **All tasks `done`** → mark `meta.status: done`, then **remove the entire plan entry from `plan.md`** (its definition is preserved in the run archive).
- **Mixed states** (some done, some failed/blocked/needs-review/pending) → mark `meta.status: in-progress`. Keep the plan entry, but **prune the `done` tasks from its Execution section**. Update remaining tasks' `status` field per their final state:
  - `failed` tasks stay with `status: failed` — user re-plans (shaper/architect) or removes them manually.
  - `blocked` tasks stay with `status: blocked` — same.
  - `pending` (never executed this run) tasks stay `status: pending` — next pipeline run picks them up.
  - (No `needs-review` should appear here — those came in from a prior crash and were either resolved this run or stayed in some other terminal state.)

The pruning matters because next pipeline activation re-stages the in-progress plan; without pruning, completed tasks would re-execute. The done work lives in the run archive — that's the source of truth for "what was done."

Plans the run did **not** touch are unchanged.

If `plan.md` has zero remaining plans after this pass, leave the file with placeholder text:

```
# {Project} — Plan Queue

No active plans. Run `/absol` and choose pipeline mode to plan from inbox/bugs/tech-debt, or `/absol-architect` for a refactor plan.
```

Scratchpad runs don't touch plan.md (no plan-id linkage beyond the SCRATCHPAD sentinel).

### 7. Remove resolved [note]s

Walk `[note]` entries in `inbox.md` / `bugs.md` / `tech-debt.md`. For each note with `status: promoted`:

- Read its `promoted_to` field (`PLAN-NNN` for pipeline, `SCR-NNN` for scratchpad).
- If the owning plan was just removed in Step 6 (pipeline), or this is a scratchpad and the SCR task resolved → **remove the note entry**.
- If the owning plan still exists (had unresolved tasks) → leave the note. It'll be cleared on a future finalize.

This is the "items removed once their work completed" rule. Notes never accumulate post-completion.

### 8. Update state.md

`state.md` becomes a clean current-truth snapshot. Three sections:

```
# {Project} — Current State

*Last updated: {date}*

## Last Session

{1–3 sentence summary: what plans/scratchpad tasks completed, any failures, files modified, time of run.}

## In Progress

{Plans with status: in-progress. One line per plan. "Nothing." if none.}

## Parked Items

{Notes with shaper_notes but no promoted_to (shaped but not yet planned).
 One line per item. "None." if none.}
```

**Do not** add Tech Debt, Known Bugs, Planned Features, Pipeline History, or other accumulating sections. Those live in their own `.absol/` files.

The transient `## Active Run` and `## Pause` sections were cleared in Step 5. Don't write them back.

### 9. Roll up old history

Two monthly rollups keep the archive from growing unbounded:

- **Sessions.** Keep only the most-recent Last Session summary in `state.md`. Roll older summaries into `archive/sessions-{YYYY-MM}.md`, one `## {prior_run_id} ({prior_date})` block each (verbatim).
- **Runs.** Append every run archive dated **before the current month** into `archive/runs-{YYYY-MM}.md` (the lean per-run block verbatim under its `# {run_id}` header), then delete those individual `run-*.md` files. Current-month run archives stay as their own files. This is idempotent — once rolled and deleted, a run isn't seen again.

Create either monthly file with a `# {Sessions | Runs} — {YYYY-MM}` header on the first write of the month.

### 10. Report

```
## Finalization Summary — {run_id}

Tasks resolved: {n_done} done, {n_failed} failed, {n_blocked} blocked, {n_needs_review} needs review
Plans:          PLAN-NNN: done (removed)
                PLAN-MMM: in-progress ({k} tasks remain)
Notes cleared:  {n} from inbox, {m} from bugs, {p} from tech-debt
Files modified: {list — pulled from union of files_touched_actual}
Archive:        archive/run-{run_id}.md

Failed tasks: TSK-XXX: {reason}                        (omit if zero)
Blocked tasks: TSK-XXX: {blocker}                      (omit if zero)
Needs review: TSK-XXX: {fix_request}                   (omit if zero)
Divergence flags: TSK-XXX touched {N} unexpected files (omit if zero)
Pause cleared: {run_id}                                (omit if no pause was cleared)

Run logged. Safe to end the session.
```

Suppress empty subsections. If anything failed or stayed blocked or has fix-required, surface prominently — that's what the user needs to act on.

## Rules

- Same machinery for pipeline (`RUN-`) and scratchpad (`SCR-`) runs. Distinguish by `mode:` in run-active.md header; treat each archive identically.
- Only durable run history is `archive/run-{run_id}.md`. Do not duplicate run state in `state.md`.
- Plans are removed from `plan.md` when fully done. Their content lives in the run archive.
- Notes are removed when their owning plan/scratchpad completes. Their content lives in the run archive (carried into the plan's seed section).
- `state.md` is a snapshot, not a ledger. Three persistent sections; the transient sections are cleared by you on close.
- Never write to `bugs.md` / `tech-debt.md` content — only remove `[note]` entries that are `status: promoted` and whose owning work completed.
- Only delete `run-active.md` AFTER the archive write succeeds. If the archive write fails (disk full, permissions), don't delete — leave the file for retry.
- If something looks wrong (run-active.md references a plan that doesn't exist, snapshot disagrees with events) → don't repair silently. Surface in the report and let the user fix.
