---
name: absol-batch-builder
description: "[INTERNAL] Groups todo.md tasks into coherent, dependency-aware execution batches. This is an internal component invoked by absol-orchestrate — do NOT trigger this skill directly from user input. Only use when explicitly instructed by the absol-orchestrate skill or when the user explicitly says '/absol-batch-builder'."
---

# absol-batch-builder

You read `todo.md` and group pending tasks into coherent execution batches with dependency-aware ordering. You produce batch definitions — you do not execute anything.

## Inputs you read

- `todo.md` — the task list (only pending tasks matter)
- `state.md` — current project truth (for subsystem context)

## Outputs you write

- Batch output to conversation (for orchestrator consumption) or to a scratch file if requested
- You do NOT modify `todo.md`

## Step 1 — Find the project

Identify the project directory from context. Read `todo.md` and `state.md`.

## Step 2 — Collect pending tasks

Extract all tasks with `status: pending` from `todo.md`. Ignore done/failed/blocked tasks.

If no pending tasks exist, report that and stop.

## Step 3 — Build the dependency graph

For each pending task:
1. Parse `dependencies` field — resolve task IDs
2. Check if dependencies are satisfied (status: done) or still pending
3. Tasks with unsatisfied dependencies are **blocked**
4. Tasks with no dependencies or all-satisfied dependencies are **ready**

## Step 4 — Identify shared state conflicts

Tasks that touch the same files, modules, or subsystems should NOT run in parallel even if they have no explicit dependency. Check:

- `subsystem` field overlap
- Obvious file path overlap from `description` or `title`
- `batching_hint` field — tasks with the same hint belong together

When in doubt, serialize. Fake independence causes merge conflicts and subtle bugs.

## Step 5 — Group into batches

Create batches by grouping related ready tasks:

1. **Batch by hint first** — tasks with matching `batching_hint` go together
2. **Batch by subsystem** — tasks in the same subsystem go together if no hint
3. **Batch by type** — similar task types (e.g. all CHORE tasks) can batch if unrelated
4. **Keep batches small** — 3-6 tasks per batch is ideal. Larger batches are harder to review.

Within each batch, determine:
- **Parallel groups**: Tasks that can safely run simultaneously (no shared state, no dependency)
- **Serial chains**: Tasks that must run in order (dependency or shared state)

## Step 6 — Order the batches

Order batches by:
1. Dependency chains (prerequisite batches first)
2. Risk level (lower risk first when no dependency constraint)
3. Batch size (smaller batches first for early wins)

## Step 7 — Output batch definitions

For each batch, output using the `[batch]` schema:

```
- [batch]
  - id: BAT-{sequential}
  - title: {short description of what this batch accomplishes}
  - included_tasks: TSK-001, TSK-002, TSK-003
  - blocked_tasks: TSK-004 (waiting on TSK-001)
  - parallel_groups: [TSK-001, TSK-002] | [TSK-003]
  - serial_chain: TSK-001 → TSK-003
  - notes: {any relevant context or warnings}
```

## Step 8 — Summary

After all batches, provide a short summary:
- Total pending tasks
- Total batches created
- Total blocked tasks (and why)
- Recommended execution order
- Any risks or concerns

## Rules

- Never claim tasks are parallel if they touch the same subsystem unless you are certain they operate on disjoint files
- Never include blocked tasks in a batch's included_tasks — list them separately
- If all tasks are blocked (circular dependency or missing prerequisites), report the problem clearly
- Prefer smaller, safer batches over large ambitious ones
- A batch with a single task is fine if that task has dependencies on the rest
