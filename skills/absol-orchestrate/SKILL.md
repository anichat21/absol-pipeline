---
name: absol-orchestrate
description: Coordinates the full absol workflow pipeline — shape, plan, checkpoint, execute (with HITL pauses), review, finalize. Use whenever the user wants to run the absol pipeline, orchestrate work, process requests through the full workflow, or coordinate project execution. Trigger on phrases like "orchestrate", "run the pipeline", "process this through absol", "run absol", or when the user provides work requests and expects full pipeline handling. Main entry point for the absol workflow system.
---

# absol-orchestrate

> **Runs on sonnet by default** (your session model). Two pipeline agents are pinned to opus — `absol-planner` (decomposition + HITL clustering + ADR cross-check) and `absol-reviewer-complex` (ARCH and high-risk reviews). Everything else (shaper, executor, finalizer, micro-exec) stays on sonnet. No need to switch sessions.

Conductor of the pipeline. Decides phase, invokes components, keeps each one in its lane. Doesn't do the work.

```
intake → shape (light, 1–3 q) → plan (subsumes triage) → checkpoint
       → serial execution (pauses at HITL) → review (if needed) → finalize
```

Triage merged into the planner. Fast-track merged into the executor as the `micro` tier. Two tiers, no fast-track agent.

## Layout

`.absol/` layout assumed; if absent, fall back to root paths and recommend `/absol-migrate` in the finalize summary.

| Path | Role |
|---|---|
| `state.md` (root) | Truth snapshot. Finalizer-owned. |
| `vision.md`, `roadmap.md` (root) | Read-only here. |
| `CLAUDE.md` (root) | Project meta. |
| `.absol/CONTEXT.md` | Domain glossary. **Every agent reads this.** |
| `.absol/adr/` | Decisions. **Every agent scans these.** |
| `.absol/inbox.md` | `status: new \| needs-shaping \| shaped \| promoted` |
| `.absol/plan.md` | Shaped items with `modules`, `testing`, `out_of_scope`. |
| `.absol/todo.md` | Tasks with `hitl`, `executor_tier`, `execution_order`. |
| `.absol/todo-run.md` | Live `[job]` entries. |
| `.absol/bugs.md`, `.absol/tech-debt.md` | Architect-owned removals. |

## Run ID

`RUN-{YYYY-MM-DD}` (counter `-2`, `-3` for same-day reruns). Check `todo-run.md` for collisions. Flows into every `[job]`. Stale run_id in `todo-run.md` → warn the user, offer to finalize the old run first.

## Phase detection

Read project files at start. Decide entry point:

1. New requests + vague signals → shape → plan → checkpoint
2. Checkpoint approved → execution loop
3. `todo.md` has pending tasks with current run_id → resume from next pending
4. `todo-run.md` has `review_flag: yes` / `failed` / `needs-review` → review
5. `todo-run.md` has resolved jobs ready for finalize → finalize
6. `todo-run.md` has stale run_id → warn, offer to finalize old run first
7. Clean → report status

"Continue" / "keep going" → detect phase, resume; skip shape/plan/checkpoint.

## Component routing

| Component | Mode | Model | Definition path | When |
|---|---|---|---|---|
| `absol-shaper` | inline (interactive) | n/a | `agents/absol-shaper.md` | Vague request detected. Strict 1–3 question budget; otherwise park as `status: needs-shaping`. |
| `absol-planner` | Agent tool | opus | `agents/absol-planner.md` | After shape (or directly on clear input). Triage + decompose; tags `hitl`, `executor_tier`, `execution_order`. |
| `absol-executor` (micro) | inline | n/a | `agents/absol-executor.md` | Task `executor_tier: micro`. Make the edit, run verification, write `[job]` with `worker: inline`. |
| `absol-executor` (full) | Agent tool | sonnet | `agents/absol-executor.md` | Task `executor_tier: full`. |
| `absol-reviewer` | Agent tool | sonnet | `agents/absol-reviewer.md` | Routine reviews. Pass filtered jobs+tasks. |
| `absol-reviewer-complex` | Agent tool | opus | `agents/absol-reviewer-complex.md` | Deep reviews (ARCH, high-risk, complex, inconclusive). Pass filtered jobs+tasks. |
| `absol-finalizer` | skill (inline) | n/a | `skills/absol-finalizer/SKILL.md` | End of run. Mandatory. |

### Agent self-loading

Build prompts as: *"Read your definition at `{absolute path}` first. Then handle: {task-specific inputs}."* Don't paste the full agent definition — saves ~12 definitions of context per 10-task run.

If an agent fails (permissions, tool errors), capture its analysis and either retry or apply changes yourself. Don't re-execute the agent's logic inline.

## Flow

### Step 1 — Assess

Read project files. Detect layout. Generate run_id (or reuse if resuming).

### Step 2 — Shape (if needed)

Split user input into clear / vague (signals: "discuss", "thinking about", "X or Y?", "some Y", question marks asking for design input, missing key details). Run `absol-shaper` inline on vague items. **Strict 1–3 question budget per item.** Unresolved → parked back into `inbox.md` as `status: needs-shaping`. Pipeline continues. The user can `/grill-me` parked items later. Combine shaped + clear; proceed.

### Step 3 — Plan (subsumes triage)

Spawn `absol-planner` (opus). Reads inbox/plan/state/CONTEXT.md/ADRs, classifies and writes inbox/plan entries (the old triage step), decomposes shaped items into `[task]` entries in `todo.md`, tags every task.

**Vertical-slice rule.** Every task is a tracer bullet through every layer it touches. Pure horizontal tasks ("rewrite all schemas") are forbidden.

**HITL clustering.** `hitl: yes` tasks cluster at the **start** of the run when dependencies allow, otherwise the end. Never interleave HITL between AFK runs of work.

### Step 4 — Checkpoint (REQUIRED)

Show the task summary, then use the **`AskUserQuestion` tool** to collect the decision (don't ask via plain `[y/n]` text in the conversation).

Summary text:

```
## Pipeline Checkpoint — {run_id}

HITL ({n_hitl}, will pause):
  1. {title} — {type}, {risk}, tier: {tier}

AFK ({n_afk}, unattended):
  M. {title} — {type}, {risk}, tier: {tier}
```

Then `AskUserQuestion`:

- question: `Proceed with this plan?`
- header: `Checkpoint`
- options:
  - **Proceed** — start serial execution.
  - **Adjust** — describe changes; minor edits land on `todo.md`, significant changes re-run the planner.
  - **Cancel** — stop here; nothing executes.

### Step 5 — Execution

#### 5a — Identify dangling-small tasks

Before walking `execution_order`, compute the **dangling-small** set. A task qualifies if **all** of:

- `dependencies: none`
- No other task lists it in their dependencies (true DAG leaf)
- `risk: low`
- `hitl: no`
- `files_touched_planned` is disjoint from every other task in the run

Skip this phase if the set is empty or has only one task — single-task parallel buys nothing.

#### 5b — Fan out dangling-small in the background

For each dangling-small task, spawn `absol-executor` (sonnet) using the Agent tool with `run_in_background: true`. The prompt MUST include the line:

> `parallel_mode: yes — direct edit only, skip TDD, skip verification, write [job] with verification_result: skipped.`

When the dangling-small set is non-empty, **parallel mode is active for the whole run** — every executor (background, serial-full, serial-micro) skips per-task verification, since concurrent verify chains race on `dist/`, `tsconfig.tsbuildinfo`, and vitest temp dirs. The Step 7 pre-finalize verify is the only safety net; surface this at the Step 7 checkpoint and recommend Run (do not default to Skip).

Background failures are **quiet** — recorded as `[job]` entries with `status: failed`, surfaced in the finalize summary, do NOT interrupt the serial path.

#### 5c — Walk the serial path

Iterate `execution_order` over the remaining tasks (those NOT in the dangling-small set). Per task:

**HITL pause** (when `hitl: yes`): show the full task entry (id, title, description, files, risk, dependencies, acceptance criteria, verification), then use the **`AskUserQuestion` tool**:

- question: `HITL: how should I handle TSK-{id}?`
- header: `HITL`
- options:
  - **Approve** — run the executor as-is.
  - **Amend** — describe changes; orchestrator updates the task description, then runs the executor.
  - **Pivot** — re-plan the task (or subtree); orchestrator calls the planner with your redirect.
  - **Reject** — mark `status: failed` with the reason; continue to the next task.

The tool's automatic "Other" free-text option captures arbitrary input.

**Executor selection** (when `hitl: no` or HITL approved):

- `executor_tier: micro` → orchestrator does it inline. Make the edit, write `[job]` with `worker: inline`. Run the task's `verification` only when parallel mode is **not** active for this run; otherwise record `verification_result: skipped`.
- `executor_tier: full` → spawn `absol-executor` (sonnet). When parallel mode is active for the run, include the same `parallel_mode: yes …` line in the prompt; otherwise the executor runs TDD red-green-refactor for FEAT and medium+ BUG, direct edit for TWEAK / CHORE.

After each task: success → continue. Failed/blocked → stop, report, then `AskUserQuestion`:

- question: `TSK-{id} {failed|blocked}: how do you want to proceed?`
- header: `Failure`
- options:
  - **Retry** — re-run the executor on the same task.
  - **Skip** — mark this task and continue with the next.
  - **Abort** — stop the run; surface what completed and proceed to the finalization checkpoint.

#### 5d — Await background tasks

After the serial path completes (or aborts), wait for any still-running background tasks before proceeding to review/finalize. Their `[job]` entries appear in `todo-run.md` as they land. Do not poll — the runtime delivers a notification when each background Agent completes.

### Step 6 — Review (if needed)

Scan `todo-run.md` for `review_flag: yes` / `failed` / `needs-review`. None → skip.

**Pass filtered data.** Extract just the relevant `[job]` and matching `[task]` entries; pass them in the prompt. Don't make the reviewer parse the entire `todo-run.md`.

Routine → `absol-reviewer` (sonnet). ARCH / high-risk / complex / inconclusive prior reviews / multiple related failures → `absol-reviewer-complex` (opus).

Fix-required verdicts feed the **next** planning cycle. Do not re-execute immediately — keep fix tasks visible in `todo.md`.

### Step 7 — Finalization Checkpoint (REQUIRED)

Cannot be skipped. If context is running low, present this before anything else.

**Read pipeline commands first.** Scan `CLAUDE.md` for a `## Pipeline Commands` section with bullet entries:

```
## Pipeline Commands

- **verify:** `<command>` — fast static checks (typecheck/lint/test/build)
- **smoke:** `<command>` — full smoke path (e.g. Docker rebuild, integration suite)
```

Either may be absent. If `verify` is missing, infer a sensible default for the project type (e.g. `npm run typecheck && npm run lint && npm run test && npm run build` for JS) and use it. If `smoke` is absent, omit smoke from the question — don't invent one.

Summary text:

```
## Finalization Checkpoint — {run_id}

Execution: {done}/{total} done, {failed} failed, {blocked} blocked, {parked} parked.
Files modified: {list}
```

Then **two** `AskUserQuestion` calls (sequential, not multiselect):

1. Pre-finalize check question. Shape depends on what's declared:

   **Both verify and smoke declared** — header: `Pre-finalize`, question: `Run pre-finalize checks?`
   - **Verify + smoke (Recommended)** — run verify, then smoke, report both.
   - **Verify only** — run verify command, report.
   - **Smoke only** — run smoke command, report.
   - **Skip** — go straight to the finalize question.

   **Only verify declared/inferred** — header: `Build & test`, question: `Run build & test before finalizing?`
   - **Run** — execute verify and report.
   - **Skip** — go straight to finalize.

   Smoke commands are typically slow (container rebuilds, full integration suites). Note expected duration if obvious (e.g. *"~2 min container rebuild"*).

2. If any check ran and failed, surface the failure first, then ask:
   question: `Finalize anyway? state.md and the run archive will reflect the failure.` — header: `Finalize`
   options: **Finalize**, **Stop** (warn state may be inconsistent).

   Otherwise:
   question: `Run absol-finalizer now?` — header: `Finalize`
   options: **Finalize**, **Stop** (warn state may be inconsistent).

## Rules

- Plan owns triage, classification, decomposition.
- Vertical slices only. Horizontal-only tasks rejected at planning.
- HITL pauses; AFK doesn't.
- Review selectively. Clean passes skip review.
- Finalize is mandatory.
- Planning and execution stay separate.
- Serial, one task at a time.
- Component failure → report and stop. Don't auto-retry.
- Inconsistent state (todo-run has entries but todo is empty, etc.) → investigate before proceeding.
- Missing files → create with appropriate header. Don't create `CONTEXT.md` from nothing — empty is fine on a young project.
