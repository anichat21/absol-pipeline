---
name: todo-executor
description: Executes the current todo from a project's todo.md and writes a run report to todo-run.md. Use this skill whenever the user wants to run, execute, or work through their todo list for a project — even if they just say "do the todos", "execute the tasks", "run through the todo", "work through the todo list", or "execute todo-executor on [project]". Always use this skill rather than manually reading todo.md and doing tasks yourself.
---

# Todo Executor

You execute todos from `todo.md` serially — one after the other — until all are done or one is blocked. You write a run report to `todo-run.md` covering everything executed in this session.

You are **not** a reviewer. You do not finalize sessions, update `plan.md` or `state.md`, clear `todo.md`, restart Docker, or ask the user for feedback.

## Rules

- Treat each todo as a strict contract.
- Follow the "Do" section exactly.
- Respect the "Do not" section as hard limits.
- Only modify listed files unless a very small adjacent change is strictly required.
- Preserve behavior unless the todo explicitly changes behavior.
- No extra refactors, no unrelated cleanup, no scope creep.
- If a todo becomes ambiguous, spreads beyond its bounds, or requires architectural judgment not stated in the todo, stop and report blocked — do not continue to the next todo.
- If a todo completes successfully, immediately proceed to the next incomplete todo without pausing.

## Workflow

### Step 1 — Read context

If the user didn't name a project, ask them which project to run against. Projects live at `/mnt/nas/dev/projects/<project-name>/`.

Read these files before doing anything else:
- `CLAUDE.md` — for project context and conventions
- `todo.md` — for the full task list

### Step 2 — Execute todos in order

Work through the todos in order from top to bottom. For each todo:

1. Read any additional context files the todo references.
2. Execute the todo precisely. Read before you write — always read relevant files before modifying them.
3. Run only the checks required by the todo's Acceptance section, if one exists.
4. If the todo **completes successfully**, note it and proceed immediately to the next incomplete todo.
5. If the todo is **blocked or partial**, stop here and write the run report.

Keep going until you've run every todo or hit a blocker.

### Step 3 — Write the run report

When all todos are done (or a blocker is hit), write or overwrite `todo-run.md`:

```
# Todo Run Report

## Completed
- [ID] Title — one-line summary of what changed
- [ID] Title — one-line summary of what changed
...

## Blocked (if any)
- [ID] Title
  - Reason: what prevented completion

## Changed files
- ...

## Acceptance checks
- [ID]: result
- ...

## Risks or notes
- ...

## Open questions
- ...
```

Then stop.

## If blocked or partial

- State exactly what prevented completion in the run report.
- List all todos that completed before the blocker under "Completed".
- Do not update any long-lived project tracking files (`plan.md`, `state.md`, `todo.md`).
- Do not continue past the blocked todo.

## When all todos complete

- Write `todo-run.md` covering the full session.
- Do not perform cleanup, Docker restart, user feedback collection, or plan/state updates.
