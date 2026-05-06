---
name: absol-orchestrate
description: Execution engine for the absol pipeline. Reads plan.md, asks the user which plans to run this session, copies the selected plans' tasks into todo-run.md, executes them serially (with HITL pauses, test-fail auto-loop, review pass), and hands off to absol-finalizer. Does NOT plan, does NOT shape, does NOT classify — those happen upstream in absol-shaper / note-taker / absol-planner before this skill runs. Invoked by the /absol entry skill when the user wants pipeline mode, or directly when the user says 'orchestrate', 'run the pipeline on plan.md', 'execute plans', or wants to walk through plan.md. Main pipeline runner.
---

# absol-orchestrate

Conductor of the execution phase. The plan already exists; your job is to run it. Decide phase, invoke components, keep each one in its lane. **You do not edit source files. You do not classify intake. You do not design tasks.** Those are owned by note-taker, absol-shaper, and absol-planner respectively, and they run before you.

```
/absol → (plan.md populated by planner) → orchestrate → finalizer
                                          ↑ you are here
```

## Layout

`.absol/` layout assumed; if absent, fall back to root paths and recommend `/absol-migrate` in the finalize summary.

| Path | Role |
|---|---|
| `state.md` (root) | Truth snapshot. Finalizer-owned. Holds `## Pause` section while paused. |
| `vision.md`, `roadmap.md`, `CLAUDE.md` (root) | Read-only here. |
| `.absol/CONTEXT.md` | Domain glossary. Every agent reads this. |
| `.absol/adr/` | Decisions. Every agent scans these. |
| `.absol/plan.md` | PLAN-NNN entries with seeds + execution. Read-only here (planner-owned). |
| `.absol/todo-run.md` | Live execution journal. Cleared at session start. |
| `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md` | Read-only here (note-taker / planner / finalizer-owned). |

## Run ID

`RUN-{YYYY-MM-DD}` (counter `-2`, `-3` for same-day reruns). Check `todo-run.md` for collisions. Flows into every `[task]` in todo-run.md. Stale run_id in `todo-run.md` → tell the user, offer to finalize the old run first via `absol-finalizer`.

## Inputs

From `/absol`:

- `project_path:` absolute path to project root.
- (Optional) `selected_plans:` PLAN-NNN list if `/absol` already collected the choice. If omitted, you ask via the pre-launch checkpoint.

## Component routing

| Component | Mode | Model | Definition path | When |
|---|---|---|---|---|
| `absol-planner` | Agent tool | opus | `agents/absol-planner.md` | Test-fail auto-loop only — re-plans the fix. (Planning before pipeline is `/absol`'s call.) |
| `absol-executor` (full) | Agent tool | sonnet | `agents/absol-executor.md` | Task `executor_tier: full`. |
| `absol-executor` (micro) | inline | n/a | `agents/absol-executor.md` | Task `executor_tier: micro`. Make the edit, run verification, write run-time fields. |
| `absol-reviewer` | Agent tool | sonnet | `agents/absol-reviewer.md` | Routine reviews. Pass filtered tasks. |
| `absol-reviewer-complex` | Agent tool | opus | `agents/absol-reviewer-complex.md` | ARCH, high-risk, complex, inconclusive prior reviews, multiple related failures. Pass filtered tasks. |
| `absol-finalizer` | skill (inline) | n/a | `skills/absol-finalizer/SKILL.md` | End of run. Mandatory. |

### Agent self-loading

Build prompts as: *"Read your definition at `{absolute path}` first. Then handle: {task-specific inputs}."* Don't paste the full agent definition — saves ~12 definitions of context per 10-task run.

If an agent fails (permissions, tool errors), capture its analysis, mark the task `failed` with the reason, and continue. Don't re-execute the agent's logic inline — you don't edit source files.

## Flow

### Step 1 — Assess

Read `plan.md`, `state.md`, `.absol/CONTEXT.md`, `.absol/adr/`. Detect layout. Generate run_id (or reuse if resuming).

If `state.md` has a `## Pause` section, you're resuming a prior pipeline. Read the pause record (`run_id`, `next_task`); skip Steps 2 and 3, jump to Step 4 starting from `next_task`. The pause section gets cleared by `absol-finalizer` on successful close.

### Step 2 — Pre-launch checkpoint (REQUIRED)

Always ask. Even when `/absol` indicated which plans, confirm — the user might have changed their mind in the seconds between.

Show the available plans:

```
## Pipeline Pre-launch — {run_id}

Available plans (status: ready):
  PLAN-001: <title>
    Tasks: 4 (1 HITL, 3 AFK)
    Subsystem: <area>
  PLAN-002: <title>
    Tasks: 7 (2 HITL, 5 AFK)
    Subsystem: <area>
```

Then `AskUserQuestion`:

- question: `Which plan(s) should this run execute?`
- header: `Plans`
- options:
  - **All ready** — execute every plan with `status: ready`.
  - **Pick subset** — user names which (use the tool's "Other" free-text).
  - **Cancel** — abort; nothing executes.

### Step 3 — Stage todo-run.md

Clear `todo-run.md` (write header `# todo-run.md — RUN-{run_id} active since {date}`).

For each selected plan, flip `meta.status` to `in-progress` in `plan.md`, then copy each `[task]` from the plan's Execution section into `todo-run.md`. Add the run-time skeleton:

```
- [task]
  - id: TSK-001
  - plan_id: PLAN-001                        ← FK
  - run_id: RUN-2026-05-06
  - <static fields copied from plan.md verbatim>
  - status: pending
  - retry_count: 0
```

Re-number `execution_order` globally if you're staging multiple plans (so orchestrator can walk one ordered queue).

### Step 4 — Serial execution

Walk `todo-run.md` in `execution_order`. For each task:

#### 4a — Pause check (every task boundary)

If the user has signalled pause (typed *"pause"*, *"hold on"*, etc. in chat), or `/absol` has set a pause flag, **finish the current task** (don't kill it mid-edit; broken intermediate state is worse than waiting), then write `## Pause` to `state.md`:

```
## Pause

- run_id: {run_id}
- paused_at: {ISO timestamp}
- last_completed_task: TSK-NNN
- next_task: TSK-MMM
- reason: user-requested
```

Stop. The user resumes via `/absol` (which calls you back at Step 1).

#### 4b — HITL pause (when `hitl: yes`)

Show the full task entry (id, title, description, files_touched, risk, dependencies, acceptance_criteria, verification). Then `AskUserQuestion`:

- question: `HITL: how should I handle TSK-{id}?`
- header: `HITL`
- options:
  - **Approve** — run the executor as-is.
  - **Amend** — describe changes; you update the task `description`, then run the executor.
  - **Pivot** — re-plan this task; spawn `absol-planner` with the user's redirect as input. New plan replaces this task in todo-run.md.
  - **Reject** — mark `status: failed` with the reason; continue to the next task.

The "Other" free-text option captures arbitrary input (treated as Amend by default).

#### 4c — Execute

- `executor_tier: micro` — you do it inline. Make the edit. Run the task's `verification`. Write run-time fields to the `[task]` entry: `worker: inline`, `status`, `files_touched_actual`, `summary`, `verification_result`.
- `executor_tier: full` — spawn `absol-executor` (sonnet) via Agent tool. Pass: task entry, project path, run_id. Executor writes run-time fields directly to `todo-run.md`.

#### 4d — Verification + test-fail loop

After execution, check `verification_result`:

- **`pass`** → mark `status: done`, continue to next task.
- **`fail`** or `status: failed` → enter the **test-fail auto-loop**:
  1. Increment `retry_count`.
  2. If `retry_count <= 2`: spawn `absol-planner` with the failing task + verification output as input. Planner designs the fix (typically an amended task description or a small new task). Re-execute. Re-verify. Loop.
  3. If `retry_count > 2`: **stop the loop** and surface to user via `AskUserQuestion`:
     - question: `TSK-{id} failed after 2 retries. How should we resolve?`
     - header: `Test failure`
     - options:
       - **Solve now** — re-enter the loop with user input added as a constraint to the planner.
       - **Log and finalise** — accept the failure into the run record; jump to Step 6 (finalize).
       - **Discuss** — log + finalise + open scratchpad mode for free-form discussion. Pipeline ends; nothing more executes.

- **`blocked`** → mark blocked with reason; continue to next task. Surface in finalize summary.

#### 4e — Mid-task observations

If the executor reports an unrelated bug or a stray observation, do **not** fix it — note it in the task's `summary` field and recommend the user run `note-taker` after the session. The orchestrator's lane is execution, not opportunistic edits.

### Step 5 — Review (if needed)

Scan `todo-run.md` for `[task]` entries with `review_flag: yes`, `status: failed`, or `status: needs-review`. None → skip Step 5.

**Pass filtered data.** Extract just the relevant `[task]` entries and the source files they touched; pass them in the prompt. Don't make the reviewer parse the entire `todo-run.md`.

| Reviewer | Use when |
|---|---|
| `absol-reviewer` (sonnet) | Routine reviews, single-task, low/medium risk. |
| `absol-reviewer-complex` (opus) | ARCH-typed tasks, high-risk, prior review inconclusive, multiple related failures. |

Append `[review]` entries to `todo-run.md`. Fix-required verdicts feed the next planning cycle (typically the test-fail auto-loop, but at this point you've exited that loop — record the verdict, surface in finalize, let the user decide on `/absol` next round).

### Step 6 — Finalization Checkpoint (REQUIRED)

Cannot be skipped. If context is running low, present this before anything else.

**Read pipeline commands first.** Scan `CLAUDE.md` for a `## Pipeline Commands` section:

```
## Pipeline Commands

- **verify:** `<command>` — fast static checks (typecheck/lint/test/build)
- **smoke:** `<command>` — full smoke path (e.g. Docker rebuild, integration suite)
```

Either may be absent. If `verify` is missing, infer a sensible default for the project type (e.g. `npm run typecheck && npm run lint && npm run test && npm run build` for JS) and use it. If `smoke` is absent, omit smoke from the question — don't invent one.

Summary text:

```
## Finalization Checkpoint — {run_id}

Plans:        PLAN-001 (4/4 done), PLAN-002 (5/7 done — 2 failed)
Execution:    {n_done} done, {n_failed} failed, {n_blocked} blocked
Review:       {n_reviewed} reviewed — {n_approved} approved, {n_fix} fix-required
Files modified: {list}
```

Then **two** `AskUserQuestion` calls (sequential, not multiselect):

1. Pre-finalize check question — shape depends on what's declared:

   **Both verify and smoke declared** — header: `Pre-finalize`, question: `Run pre-finalize checks?`
   - **Verify + smoke (Recommended)** — run verify, then smoke, report both.
   - **Verify only** — run verify, report.
   - **Smoke only** — run smoke, report.
   - **Skip** — go straight to the finalize question.

   **Only verify declared/inferred** — header: `Build & test`, question: `Run build & test before finalizing?`
   - **Run** — execute verify and report.
   - **Skip** — go straight to finalize.

   Smoke commands are typically slow. Note expected duration if obvious (e.g. *"~2 min container rebuild"*).

2. If any check ran and failed, surface the failure first, then ask:
   question: `Finalize anyway? state.md and the run archive will reflect the failure.` — header: `Finalize`
   options: **Finalize**, **Stop** (warn state may be inconsistent).

   Otherwise:
   question: `Run absol-finalizer now?` — header: `Finalize`
   options: **Finalize**, **Stop** (warn state may be inconsistent).

On **Finalize**: invoke `absol-finalizer`. On **Stop**: leave todo-run.md as-is, don't update state.md. Tell the user the run is unfinalized and that `/absol` will detect it on next entry.

## Rules

- You do NOT edit source files. Verification failure → re-spawn executor via the test-fail loop, or mark `failed`. The "orchestrator-fixup" pattern is forbidden.
- You do NOT classify intake or design tasks. plan.md is your input; producing it is upstream.
- Serial execution. One task at a time. No parallel mode, no dangling-small fanout.
- Plan owns task definitions. todo-run.md is the journal — never modify the static fields, only fill in run-time fields as work progresses.
- HITL pauses; AFK doesn't. HITL clustering happened at planning — trust the order.
- Review selectively. Clean passes skip Step 5.
- Finalize is mandatory. Even on Stop, the unfinalized run is a known state.
- Component agent failure → mark task failed with the reason, continue. Don't auto-retry blindly at the agent-call level (the test-fail loop is at the verification level, which is different).
- Pause check is at task boundary, not mid-task. Broken intermediate state is worse than waiting one task.
- Inconsistent state (todo-run has entries from a prior run, plan.md is empty mid-execution, etc.) → investigate and tell the user before proceeding.
- Missing files → create with appropriate header. Don't fabricate plan.md content — empty plan.md means the user should go back to `/absol` and run the planner.
