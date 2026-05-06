---
name: absol-finalizer
description: "[INTERNAL] Closes an absol run (pipeline or scratchpad). Archives todo-run.md as the durable run history, removes done plans from plan.md, removes notes whose owning plan/scratchpad completed, clears any ## Pause section in state.md, updates state.md as a current-truth snapshot. Invoked by absol-orchestrate (pipeline runs) or absol-scratchpad (adhoc runs). Do NOT trigger directly except when the user explicitly says '/absol-finalizer'."
---

# absol-finalizer

Close a run. Records verified outcomes, archives execution state so files don't grow unboundedly, surfaces anything still needing the user's attention.

You handle two run shapes:

| Run shape | run_id | Triggered by |
|---|---|---|
| **Pipeline** | `RUN-YYYY-MM-DD` | `absol-orchestrate` after Step 6 finalize |
| **Scratchpad** | `SCR-YYYY-MM-DD` | `absol-scratchpad` on close |

The difference is mostly cosmetic — both run shapes write `[task]` entries to the same `todo-run.md`, so most of your work is identical. Where it differs (plan.md handling), it's flagged below.

## Layout

Assumes `.absol/`. If absent, fall back to root-level paths and append *"Layout: flat (legacy). Run `/absol-migrate` to upgrade."* to the final summary.

## Reads / writes

Reads: `.absol/todo-run.md`, `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`, `state.md`.

Writes: `state.md`, `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`, `.absol/todo-run.md`, `.absol/archive/`.

Never writes: `vision.md`, `roadmap.md`, `CLAUDE.md`, `CONTEXT.md`, ADRs.

## Steps

### 1. Determine run shape

Read `todo-run.md`. The first `[task]` entry's `run_id` tells you whether this is `RUN-` (pipeline) or `SCR-` (scratchpad).

If `todo-run.md` is empty or has no entries with the active run_id → nothing to finalize; report and exit.

### 2. Archive the run

Copy the entire `todo-run.md` to `.absol/archive/run-{run_id}.md`. This is the **definitive record** of the run — all `[task]` entries with all run-time fields, plus any `[review]` entries. The only place run history lives.

Header for the archive file:

```
# {run_id} — {date}

Closed by absol-finalizer on {ISO timestamp}.

---

<full contents of todo-run.md>
```

Pipeline runs additionally include the plan(s) they consumed — append a section at the end of the archive file with the relevant `PLAN-NNN` entries copied verbatim from `plan.md`. Scratchpad has no plans; skip.

### 3. Clear or trim todo-run.md

If every `[task]` resolved (`done | failed | blocked`):

```
# todo-run.md — cleared after finalization on {date} ({run_id} archived)
```

If unresolved tasks remain (`pending` / `in-progress` / `needs-review` left over from a Stop), keep them and remove only resolved entries. Add a header note:

```
# todo-run.md — partial finalize of {run_id}; {n} unresolved tasks retained
```

### 4. Update plan.md (pipeline runs only)

For each plan that ran this session:

- All its tasks resolved successfully → mark `meta.status: done`, then **remove the entire plan entry from `plan.md`** (its definition is now in the run archive).
- Any task failed/blocked → mark `meta.status: in-progress` (still has unresolved work). Keep the plan entry. The user can re-run it next pipeline activation, or close it manually.

Plans the run did **not** touch are unchanged.

If `plan.md` has zero remaining plans after this pass, leave the file with placeholder text:

```
# {Project} — Plan Queue

No active plans. Run `/absol` and choose pipeline mode to plan from inbox/bugs/tech-debt.
```

### 5. Remove resolved [note]s

Walk `[note]` entries in `inbox.md` / `bugs.md` / `tech-debt.md`. For each note with `status: promoted`:

- Read its `promoted_to` field (`PLAN-NNN` for pipeline, `SCR-NNN` for scratchpad).
- If the owning plan was just removed in Step 4 (pipeline), or this is a scratchpad and the SCR task resolved → **remove the note entry**.
- If the owning plan still exists (had unresolved tasks) → leave the note. It'll be cleared on a future finalize.

This is the "items removed once their work completed" rule. Notes never accumulate post-completion.

### 6. Clear ## Pause section if present

If `state.md` has a `## Pause` section and the pause's `run_id` matches the run we just finalized → remove the section entirely. The pause is over.

If the run_id doesn't match (we finalized a different run while another was paused) → leave the pause section alone. Surface in the report.

### 7. Update state.md

`state.md` is a current-truth snapshot. Three sections only:

```
# {Project} — Current State

*Last updated: {date}*

## Last Session

{1–3 sentence summary of this run: what plans/scratchpad tasks completed,
 any failures, files modified.}

## In Progress

{Plans with status: in-progress. One line per plan. "Nothing." if none.}

## Parked Items

{Notes with shaper_notes but no promoted_to (shaped but not yet planned).
 One line per item. "None." if none.}
```

**Do not** add Tech Debt, Known Bugs, Planned Features, Pipeline History, or other accumulating sections. Those live in their own `.absol/` files. The pause section (if present) is the only exception.

For multi-session continuity, only the most recent run's summary lives in Last Session. Prior sessions go to `archive/sessions-{YYYY-MM}.md` (Step 8).

### 8. Compact older sessions

Keep just the most recent run summary in `state.md` Last Session. Roll older Last Session content into `archive/sessions-{YYYY-MM}.md`:

```
## Session {prior_run_id} ({prior_date})

{prior summary, verbatim from when it was Last Session.}
```

If you're the first finalize of the month, create the file with a `# Sessions — {YYYY-MM}` header.

### 9. Report

```
## Finalization Summary — {run_id}

Tasks resolved: {n_done} done, {n_failed} failed, {n_blocked} blocked
Plans:          PLAN-NNN: done (removed)
                PLAN-MMM: in-progress ({k} tasks remain)
Notes cleared:  {n} from inbox, {m} from bugs, {p} from tech-debt
Files modified: {list — pulled from each task's files_touched_actual}
Archive:        archive/run-{run_id}.md

Failed tasks: TSK-XXX: {reason}                        (omit if zero)
Blocked tasks: TSK-XXX: {blocker}                      (omit if zero)
Pause cleared: {run_id}                                (omit if no pause was cleared)

Run logged. Safe to end the session.
```

Suppress empty subsections. If anything failed or stayed blocked, surface prominently — that's what the user needs to act on.

## Rules

- Same machinery for pipeline (`RUN-`) and scratchpad (`SCR-`) runs. Distinguish by run_id prefix; treat each archive identically.
- Only durable run history is `archive/run-{run_id}.md`. Do not duplicate run state in `state.md`.
- Plans are removed from `plan.md` when fully done. They live in the run archive.
- Notes are removed when their owning plan/scratchpad completes. They live in the run archive (their info was carried into the plan's seed section).
- `state.md` is a snapshot, not a ledger. Three sections plus optional `## Pause`. No historical stacking.
- Never write to `bugs.md` / `tech-debt.md` content — only remove `[note]` entries that are `status: promoted` and whose owning work completed. Don't reclassify, don't summarize, don't add notes.
- Never write to `CONTEXT.md`, ADRs, `vision.md`, `roadmap.md`, `CLAUDE.md`. Other components own those.
- If something looks wrong (todo-run.md references a plan that doesn't exist, etc.) → don't repair silently. Surface it in the report and let the user fix.
