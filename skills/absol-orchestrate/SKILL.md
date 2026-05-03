---
name: absol-orchestrate
description: Coordinates the full absol workflow pipeline — shape, plan, checkpoint, execute (with HITL pauses), review, finalize. Use this skill whenever the user wants to run the absol pipeline, orchestrate work, process requests through the full workflow, or coordinate project execution. Trigger on phrases like "orchestrate", "run the pipeline", "process this through absol", "run absol", or when the user provides work requests and expects full pipeline handling. This is the main entry point for the absol workflow system.
---

# absol-orchestrate

You coordinate the absol workflow pipeline. You decide what phase to run, invoke the right component, and keep each component in its lane. You are the conductor — you do not do the work yourself.

## Pipeline shape

```
intake → shape (if needed) → plan (with HITL/AFK tagging) → checkpoint
       → serial execution loop (pauses at HITL) → review (if needed) → finalize
```

Triage is no longer a separate agent. The planner subsumes triage in a single opus pass. Fast-track is no longer a separate agent. The executor handles micro and full modes itself.

Every component has a single responsibility. Don't skip steps; don't let components exceed scope.

## Layout

The pipeline runs against the `.absol/` layout:

| File | Role |
|---|---|
| `state.md` (root) | Truth snapshot. Finalizer-owned. |
| `vision.md`, `roadmap.md` (root) | Product framing. Read-only here. |
| `CLAUDE.md` (root) | Project meta, stack, run commands. |
| `.absol/CONTEXT.md` | **Domain glossary. Every agent reads this at start.** |
| `.absol/adr/` | Architecture decisions. Every agent scans this at start. |
| `.absol/inbox.md` | Active intake. Items at `status: new`, `needs-shaping`, `shaped`, `promoted`. |
| `.absol/plan.md` | Shaped items with `modules`, `testing`, `out_of_scope` sub-fields. |
| `.absol/todo.md` | Executable tasks (with `hitl`, `executor_tier`, `execution_order`). |
| `.absol/todo-run.md` | Live `[job]` entries. |
| `.absol/bugs.md`, `.absol/tech-debt.md` | Durable issue/debt logs. Architect-owned removals. |

**Legacy flat layout fallback.** If `.absol/` doesn't exist, fall back to root-level paths. Surface a one-line note in the finalize summary recommending `/absol-migrate`.

## Run ID

At the start of every pipeline invocation, generate a `run_id` of the form `RUN-{YYYY-MM-DD}`. If multiple runs happen on the same day, append a counter: `RUN-{YYYY-MM-DD}-2`, etc. Check `.absol/todo-run.md` for existing run IDs to avoid collisions.

The run ID flows into every executor and every `[job]` entry. It ties all work from a single pipeline invocation together and enables resume detection — if `todo-run.md` contains entries with a different run ID, those are from a previous session.

## Phase detection

Read the project files at start of run to decide where to enter:

1. **User has new requests** → shape if vague → plan → checkpoint
2. **Checkpoint approved** → serial execution loop
3. **`todo.md` has pending tasks with the current run ID in flight** → resume execution loop from next pending task
4. **`todo-run.md` has jobs flagged `review_flag: yes`, `failed`, or `needs-review`** → run reviewer
5. **`todo-run.md` has resolved jobs ready for finalization** → run finalizer
6. **`todo-run.md` has entries with a stale run ID** → warn user, offer to finalize the old run first
7. **Everything is clean** → report status and wait

When the user says "continue" or "keep going", detect current phase and resume — skip shape/plan and the checkpoint.

## Component routing — table

This table replaces the per-component "How to invoke" sections. The full agent definition lives in the corresponding file under `agents/`; the orchestrator passes the path so each agent reads its own definition (saves context).

| Component | Mode | Model | Definition path | When to invoke |
|---|---|---|---|---|
| `absol-shaper` | inline (interactive) | n/a | `agents/absol-shaper.md` | Vague/exploratory requests detected; budget is 1–3 quick questions per item, then park as `status: needs-shaping`. |
| `absol-planner` | Agent tool | opus | `agents/absol-planner.md` | After shape (or directly on clear input). Subsumes triage: classifies, dedupes, writes inbox/plan, then decomposes shaped items into tasks. Tags every task with `hitl`, `executor_tier`, and `execution_order`. |
| `absol-executor` (micro) | inline | n/a | `agents/absol-executor.md` | Task has `executor_tier: micro`. Make the edit yourself, run the verification, write the `[job]` entry with `worker: inline`. |
| `absol-executor` (full) | Agent tool | sonnet | `agents/absol-executor.md` | Task has `executor_tier: full`. Spawn the executor agent with the task entry, project path, run_id. |
| `absol-reviewer` | Agent tool | sonnet | `agents/absol-reviewer.md` | Routine reviews: standard flagged work, medium-risk tasks, routine verification failures. Pass the filtered job list — don't make the reviewer read all of `todo-run.md`. |
| `absol-reviewer-complex` | Agent tool | opus | `agents/absol-reviewer-complex.md` | Deep reviews: ARCH tasks, high-risk tasks, complex refactors, inconclusive prior reviews, multiple related failures. Pass filtered jobs. |
| `absol-finalizer` | Skill (inline) | n/a | `skills/absol-finalizer/SKILL.md` | End-of-run, after all execution and review is done. Mandatory — never end a run without it. |

### Agent self-loading

Spawn pattern for every agent:

1. Build the prompt as: *"Read your definition at `{absolute path to agents/<name>.md}` first. Then handle this task: {task-specific inputs}."*
2. Use the **Agent tool** with `subagent_type: general-purpose` (or the matching specialised agent type if one exists locally) and the agent's `model` parameter from the routing table.
3. Don't paste the full agent definition into the prompt — the agent reads it itself. This removes ~12 full definitions per 10-task run from orchestrator context.
4. Wait for the agent to return.

If an agent fails (permission errors, tool failures), capture its output and decide: retry the spawn, or apply the agent's analysis yourself if it produced something useful but couldn't write files. Do not re-execute the agent's logic inline.

## Pipeline rules

1. **Shape before planning vague requests.** If any are exploratory or under-specified, run them through the shaper first. Clear requests skip shaping.
2. **Plan owns triage, classification, and decomposition.** It writes inbox/plan entries and `[task]` entries in one pass.
3. **Checkpoint before executing.** After planning, always present the checkpoint to the user before any task runs.
4. **HITL pauses; AFK doesn't.** Tasks tagged `hitl: yes` halt the loop and prompt the user. Tasks tagged `hitl: no` run unattended.
5. **Review selectively.** Only flagged/failed/uncertain work goes to the reviewer. Clean passes skip review.
6. **Finalize after execution.** State updates happen only after execution (and review, if applicable). Mandatory.
7. **Planning and execution stay separate.** The planner never executes. The executor never plans.
8. **Features must integrate.** Features that don't fit cleanly get prerequisite refactor tasks first.
9. **Escalate, don't force.** If architecture resists a change, the executor marks blocked. Do not hack around — let the planner spawn an ARCH task next run, or recommend the user run `/absol-architect`.
10. **Execute serially.** One task at a time, in `execution_order`. No parallel.

## Orchestration flow

### Step 1 — Assess

Read all project files. Detect layout (`.absol/` or flat). Generate a `run_id` (or reuse the in-flight one if resuming). If the user said "continue" / "keep going", skip to the right resume point — don't re-shape, don't re-plan.

### Step 2 — Shape (if needed)

Scan the user's input for vague or exploratory requests. Split into:

- **Clear** — well-scoped, has enough detail to plan.
- **Vague** — exploratory, missing key details, asks for discussion, presents undecided alternatives, or uses signals like "discuss", "thinking about", "X or Y?", "some Y", question marks.

If vague exists, run `absol-shaper` inline (it's interactive — agents can't talk to the user). The shaper has a **strict budget of 1–3 quick clarifying questions per vague item.** If an item still isn't clear after the budget is spent, the shaper parks it back in `inbox.md` with `status: needs-shaping` and the pipeline continues.

This keeps orchestrate unattended-friendly. The user never *has* to grill — they choose to via `/grill-me` later. The finalize summary will surface parked items.

When all vague items are either shaped or parked, combine shaped + clear and proceed.

If everything was clear, skip shaping entirely.

### Step 3 — Plan (subsumes triage)

Spawn `absol-planner` (opus). The planner:

1. Reads `inbox.md`, `plan.md`, `state.md`, `CLAUDE.md`, `vision.md`, `roadmap.md`, `.absol/CONTEXT.md`, `.absol/adr/` to load context.
2. Classifies and routes incoming requests (the old triage step) into `inbox.md` and `plan.md` entries.
3. Performs integration analysis against source code.
4. Decomposes shaped items in `plan.md` into `[task]` entries written to `todo.md`.
5. Tags every task with `hitl: yes|no`, `executor_tier: micro|full`, and `execution_order`.
6. Re-orders tasks per the HITL clustering rule (see below).

**HITL clustering rule.** Tasks tagged `hitl: yes` cluster at the start of the run when the dependency graph allows; otherwise at the end. Beginning-cluster is preferred — the user sits through pauses up front, then walks away while the AFK tail runs. Never interleave HITL between AFK runs of work; that defeats the kick-off-and-walk-away goal.

**Vertical-slice rule.** Every `[task]` must be a tracer bullet — a thin path through every layer it touches (schema + API + UI + test, where applicable). Pure horizontal tasks ("rewrite all schemas," "add all API endpoints") are forbidden. Build slice 1 working end-to-end, then slice 2, then slice 3. Each slice is independently demoable.

Pass to the planner: project path, run_id, the user's clear+shaped input.

### Step 4 — Checkpoint (REQUIRED)

After planning, present the checkpoint. Never auto-run past this.

```
## Pipeline Checkpoint — {run_id}

Found {N} tasks after planning:

  HITL cluster (will pause for input):
    1. {title}  — {type}, {risk} risk, tier: {micro|full}
    ...

  AFK (run unattended):
    M. {title}  — {type}, {risk} risk, tier: {micro|full}
    ...

Total: {N_hitl} HITL + {N_afk} AFK = {N}.

Proceed? [y / n / adjust]
```

- `y` — proceed with serial execution.
- `n` — stop.
- `adjust` — apply the user's modifications. Minor edits land directly on `todo.md`; significant changes re-run the planner.

### Step 5 — Serial execution loop

Walk tasks in `execution_order`, one at a time. For each task:

#### HITL pause (when `hitl: yes`)

Present the **full task entry** (id, title, description, files involved, risk, dependencies, acceptance criteria, verification). Accept **free-form input**, not just `y/n`. The user can:

- Approve as-is → run the executor.
- Reject → mark the task `status: failed` with the user's reason; continue to the next task.
- Request changes → update the task description per the user's input, then run the executor.
- Pivot the approach → re-plan the task (or whole subtree) — call the planner with the user's redirect.

#### Executor selection (when `hitl: no` or HITL approved)

The planner already tagged `executor_tier`. Trust it.

- **`executor_tier: micro`** — make the edit yourself inline, run the task's `verification`, write the `[job]` entry with `worker: inline`. No agent spawn. Works for any low-risk single-file task — the planner doesn't restrict this to TWEAK/CHORE.
- **`executor_tier: full`** — spawn `absol-executor` (sonnet) with the task entry, project path, run_id. The executor handles its own work (TDD discipline for FEAT/medium+ BUG, plain make-the-edit for TWEAK/CHORE — see executor definition).

#### After each task

1. Read the result from the `[job]` entry or the agent return.
2. If **success** → report `"Task {N}/{total} complete: {title}"` and continue.
3. If **failed or blocked** → stop the loop. Report the failure to the user with the blocker description. Wait for instructions: retry, skip, abort.

### Step 6 — Review (if needed)

After all tasks complete (or the user stops), scan `todo-run.md` for items needing review:

- `review_flag: yes`
- `status: failed`
- `status: needs-review`

If none, skip to Step 7.

**Pass filtered data to the reviewer.** Extract just the relevant `[job]` and the matching `[task]` entries; pass them in the prompt. Don't make the reviewer parse the entire `todo-run.md` to find the 2 flagged items in 15.

Route by complexity:

- `absol-reviewer` (sonnet) — routine: standard flagged work, medium-risk tasks, routine verification failures.
- `absol-reviewer-complex` (opus) — deep: ARCH tasks, high-risk items, complex refactors, inconclusive prior reviews, multiple related failures.

If fixes are required, do **not** re-execute immediately. Report the verdicts to the user; the next planning cycle creates fix tasks. This keeps fix tasks visible in `todo.md` rather than buried in re-runs.

### Step 7 — Finalization Checkpoint (REQUIRED)

After all execution and review is done, ALWAYS present the finalization checkpoint. Not optional. Cannot be skipped.

```
## Finalization Checkpoint — {run_id}

Execution: {done}/{total} done, {failed} failed, {blocked} blocked, {parked} parked (needs-shaping).

Files modified:
- {file list}

Build & test? [y / skip]
Then finalize (state.md, archive snapshots, clear todo-run, update todo statuses)? [y / n]
```

- **build & test: y** → run project's build/test commands. Report. If they fail, ask how to proceed before finalizing.
- **finalize: y** → run `absol-finalizer` (skill, inline). Finalizer handles state.md, archive snapshots, todo cleanup. Surfaces parked needs-shaping items in its summary.
- **finalize: n** → stop. Report that finalization was skipped and state may be inconsistent.

If context is running low, present the checkpoint before anything else. **Never end a pipeline run without finalize.**

## Status reporting

After each phase, briefly report:

- What was done
- What's next
- Any blockers or parked items

Keep reports to 3–5 lines between phases. Save verbose output for the final summary.

## Error handling

- Component failure → report and stop. Do not retry automatically.
- Inconsistent state (e.g. `todo-run.md` has entries but `todo.md` is empty) → investigate before proceeding.
- Missing files → create with appropriate headers rather than failing. (Don't create `.absol/CONTEXT.md` from nothing — the project may genuinely have no terms yet; just note it.)
- Agent permission failure → capture analysis, apply changes yourself in the orchestrator context, report what you did.
