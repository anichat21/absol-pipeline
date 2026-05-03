---
name: absol-finalizer
description: "[INTERNAL] Closes an absol pipeline run: updates state.md, archives inbox/run snapshots, compacts older sessions, purges done todos. Invoked by absol-orchestrate — do NOT trigger directly. Only use when explicitly instructed by absol-orchestrate or when the user explicitly says '/absol-finalizer'."
---

# absol-finalizer

Last step in the pipeline. Records verified outcomes and archives pipeline state so files don't grow unboundedly. Never records intent as truth.

## Layout

Assumes `.absol/`. If absent, fall back to root-level paths and append *"Layout: flat (legacy). Run `/absol-migrate` to upgrade."* to the final summary.

## Inputs / outputs

Reads: `.absol/todo-run.md`, `.absol/todo.md`, `.absol/inbox.md`, `state.md`, `vision.md`, `roadmap.md`.
Writes: `state.md`, `.absol/todo.md`, `.absol/plan.md`, `.absol/inbox.md`, `.absol/todo-run.md`, `.absol/archive/{inbox,RUN,sessions}-*.md`.
Never writes: `bugs.md`, `tech-debt.md`, `CONTEXT.md`, ADRs, `vision.md`, `roadmap.md`.

## Steps

### 1. Update todo.md statuses, then purge done

For each `[job]` in `todo-run.md`, find the matching `[task]` by `task_id` and update:

- job `done` → task `status: done`
- job `failed` / `blocked` → matching task status
- job `needs-review` with resolved review → done or failed per the verdict

Then delete every `[task]` with `status: done`. `todo.md` is a working document; done tasks live in the archived `RUN-{run_id}.md`.

### 2. Purge done plan items

Delete every `[plan-item]` with `status: done` from `.absol/plan.md`.

### 3. Update state.md

For each **done** job, append concrete language to `## Last Session` based on `summary` and `files_touched`. Don't copy intent from `todo.md`. For **failed**/**blocked**, surface in the finalize summary; only put still-active work into `## In Progress`.

`state.md` no longer holds Tech Debt / Known Bugs sections — don't move debt or bug content into it.

### 4. Compact older sessions

Keep the most recent **2** sessions in detail. Collapse older ones to one line:

```
Session {run_id} ({date}): {N} tasks completed — {one-sentence summary}.
```

Append the verbose history of newly-collapsed sessions to `.absol/archive/sessions-{YYYY-MM}.md` under a `## Session {run_id}` heading.

### 5. Archive pass

#### 5a. Inbox snapshot

Pull `status: promoted` entries out of `.absol/inbox.md`. Write them to `.absol/archive/inbox-{run_id}.md` with a header. Inbox now keeps only `new`, `needs-shaping`, `shaped`. If zero promoted items, skip.

#### 5b. Run snapshot

Copy full `.absol/todo-run.md` to `.absol/archive/RUN-{run_id}.md`. This is the definitive record of the run.

`bugs.md` and `tech-debt.md` are not auto-archived — entries leave only via fix-and-task or via an ADR drafted by `/absol-architect`.

### 6. Surface parked needs-shaping items

Count items in `.absol/inbox.md` with `status: needs-shaping`. **Don't write these into state.md.** Surface them in the finalize summary so the user sees them once, in the right place.

### 7. Reset todo-run.md

If all jobs resolved → clear; leave header `# todo-run.md — cleared after finalization on {date} (RUN-{run_id} archived)`. If unresolved jobs remain (needs-review / pending human checks) → keep them, remove only resolved ones.

### 8. Report

```
## Finalization Summary — {run_id}

Completed:    TSK-...: {one-line result}
Failed:       TSK-...: {reason}                  (omit if zero)
Blocked:      TSK-...: {blocker}                 (omit if zero)
Needs human:  TSK-...: {why}                     (omit if zero)
Parked:       {n} item(s) at status: needs-shaping — run /grill-me when you have time
              - {title}                          (omit if zero)
Archive:      inbox-{run_id}.md ({n}), RUN-{run_id}.md, sessions-{YYYY-MM}.md ({m} rolled in)
State:        Last Session updated, {k} older session(s) compacted
              todo.md: {n} purged, plan.md: {n} purged, inbox.md: {n} archived
Milestones:   {any roadmap milestones reached}   (omit if none)
```

Suppress empty subsections. Flag anything needing human attention prominently.
