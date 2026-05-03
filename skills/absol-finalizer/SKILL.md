---
name: absol-finalizer
description: "[INTERNAL] Finalizes completed absol workflow runs by updating state.md and resetting tracking files. This is an internal component invoked by absol-orchestrate — do NOT trigger this skill directly from user input. Only use when explicitly instructed by the absol-orchestrate skill or when the user explicitly says '/absol-finalizer'."
---

# absol-finalizer

You read completed execution data and update project state to reflect actual reality. You are the last step in the pipeline — you record truth, not intent.

## Inputs you read

- `todo-run.md` — execution results (`[job]` entries)
- `todo.md` — task definitions (for context)
- `state.md` — current project truth
- `vision.md`, `roadmap.md` — higher-level docs (to check if milestones were reached)

## Outputs you write

- `state.md` — update to reflect completed work
- `todo.md` — update task statuses to match execution results
- `todo-run.md` — clear or archive after processing
- Relevant docs — update if completed work affects them

## Step 1 — Find the project

Identify the project directory from context. Read all input files.

## Step 2 — Process execution results

Read every `[job]` entry in `todo-run.md`. Categorize:

- **done**: Task completed and verified
- **done + review_flag: yes**: Completed but reviewer flagged issues
- **failed**: Task did not complete
- **blocked**: Task could not proceed
- **needs-review**: Awaiting review verdict

## Step 3 — Update todo.md task statuses

For each job in `todo-run.md`, find the matching task in `todo.md` by `task_id` and update its status:
- Job status `done` → task `status: done`
- Job status `failed` → task `status: failed`
- Job status `blocked` → task `status: blocked`
- Job status `needs-review` with resolved review → task `status: done` or `status: failed` based on review outcome

This is the ONLY time todo.md statuses get updated post-execution. Without this step, todo.md shows stale `pending` statuses for completed work.

## Step 3b — Purge done tasks from todo.md

After updating statuses, delete all `[task]` entries with `status: done` from `todo.md`. The full task detail for completed work is already captured in `state.md` session logs — there is no need to keep it in the task list as well.

`todo.md` is a working document, not an archive. It should only ever contain actionable items: `status: pending`, `status: blocked`, or `status: failed`. Done tasks just add noise and cause the file to grow without bound.

If `todo.md` has a header (e.g. `# Project — Todo`) or any non-task content before the first `[task]` block, preserve it. Remove only the `[task]` entries themselves.

## Step 3c — Purge done plan items from plan.md

Delete all `[plan-item]` entries with `status: done` from `plan.md`. Done plan items are already referenced in `state.md` via their decomposed TSK IDs — the record of what was planned and built lives there.

`plan.md` should only contain items that haven't been fully executed yet: pending, blocked, or items with open design decisions. If all items are done and `plan.md` becomes empty after purging, leave just the file header.

If `plan.md` has no header and becomes entirely empty, leave it as an empty file rather than deleting it — the file's presence is expected by the pipeline.

## Step 4 — Update state.md

For each **done** job (without unresolved review flags):

1. Find the relevant section in `state.md`
2. Record what was actually accomplished — use concrete language based on `summary` and `files_touched`
3. Do NOT copy intent from todo.md — describe what actually happened based on the run data

For **failed** or **blocked** jobs:
1. Add to a "Known Issues" or "Blockers" section in `state.md`
2. Include the blocker description and affected task IDs

`state.md` must reflect reality. If a task was partially completed, say so. If verification failed, say so. Never record work as done that wasn't verified.

## Step 4b — Compact old sessions in state.md

After updating `state.md` with the current run's results, compact all session entries from **previous** runs. The current run keeps its full per-task detail. Everything older gets collapsed to a single summary line per session.

Format for each compacted session:
```
Session {run_id} ({date}): {N} tasks completed — {brief one-sentence summary of what was built or fixed}
```

Example:
```
Session RUN-2026-04-27 (2026-04-27): 11 tasks completed — GlbModel runtime layer split, per-frame material policing eliminated, metadata immutability.
```

Replace each old session's full TSK-by-TSK block with this one line. Keep the overall `state.md` structure intact (headings like `## Last Session`, `## In Progress`, `## Tech Debt`, etc.) — only collapse the verbose session narrative, not the structured notes sections.

The goal is that `state.md` always has full fidelity for the latest session and a compact audit trail of older ones, rather than accumulating unbounded detail across every run.

## Step 5 — Check higher-level docs

Scan `vision.md` and `roadmap.md` for milestones that may now be complete based on the finished work. If a milestone is reached, note it in the summary but do NOT modify those files unless explicitly instructed.

## Step 6 — Compile summary

Produce a finalization summary:

```
## Finalization Summary

### Completed
- TSK-001: {one-line summary of actual result}
- TSK-002: {one-line summary of actual result}

### Failed
- TSK-003: {reason}

### Blocked
- TSK-004: {blocker}

### Needs Human Attention
- TSK-005: {why — reviewer flagged, verification failed, etc.}

### Unresolved
- {any items that need follow-up}

### State Changes
- {what was updated in state.md}

### Milestones
- {any roadmap milestones reached, or "none"}
```

## Step 7 — Reset todo-run.md

After processing all entries:
- If all jobs are resolved (done/failed/blocked with no pending review): clear `todo-run.md` and leave a header comment: `# todo-run.md — cleared after finalization on {date}`
- If unresolved jobs remain (needs-review, pending human checks): keep those entries, remove resolved ones

## Step 8 — Report

Output the finalization summary to the user. Keep it concise. Flag anything that needs human attention prominently.

## Rules

- Never record intent as truth — only record verified outcomes
- Only modify `todo.md` to update task statuses and purge completed entries (Steps 3 and 3b). Never add new task entries or rewrite existing ones — that's the planner's job
- Never modify `vision.md` or `roadmap.md` without explicit instruction
- If `todo-run.md` is empty or missing, report that there's nothing to finalize
- If `state.md` doesn't exist, create it with the completed work as the initial state
- Date references use ISO 8601 format (YYYY-MM-DD)
