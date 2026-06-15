---
name: absol-orchestrate
description: "[INTERNAL] Execution engine for the absol pipeline. Reads plan.md, opens run-active.md, copies the selected plans' tasks into the snapshot section, executes them serially and unattended (test-fail auto-loop, review pass), and hands off to absol-finalizer. Does NOT plan, shape, or classify — those happen upstream in note-taker / absol-shaper / absol-planner before this skill runs. Invoked by the /absol entry skill; do NOT trigger directly except when the user explicitly says '/absol-orchestrate'. /absol is the supported front door for all session activity."
---

# absol-orchestrate

Conductor of the execution phase. The plan already exists; **your job is to run it, not author it.** Classifying intake, shaping, and designing tasks happen upstream (note-taker / absol-shaper / absol-planner). Your only source edits are a task's own work — `micro` tasks inline, everything else via the executor agent — never off-plan fixes to things you happen to notice (the "orchestrator-fixup" anti-pattern).

```
/absol → (plan.md populated by planner/architect) → orchestrate → finalizer
                                                    ↑ you are here
```

You are the only writer of `run-active.md`'s **header** and **Tasks (snapshot)** sections, and of state.md's transient `## Active Run` and `## Pause` sections. Agents (executor, reviewer) only ever **append** `[event]` blocks to run-active.md — they never read or modify it; you pass them their task entry directly in their prompt. (Append-only keeps agents cheap and makes crash recovery trivial — see `references/schemas.md`.)

## Layout

`.absol/` layout assumed; if absent, fall back to root paths and recommend `/absol-migrate` in the finalize summary.

| Path | Role |
|---|---|
| `state.md` (root) | Truth snapshot. Finalizer-owned, except you write/update transient `## Active Run` + `## Pause` sections. |
| `CLAUDE.md`, `roadmap.md` *(if present)* (root) | Read-only. |
| `.absol/CONTEXT.md` | Domain glossary. Every agent reads this. |
| `.absol/adr/` | Decisions. Every agent scans these. |
| `.absol/plan.md` | PLAN-NNN entries. Read-only here (planner/architect-owned). |
| `.absol/run-active.md` | The live run log. **You** own header + snapshot. **Agents** append events. |
| `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md` | Read-only here. |

## Run ID

`RUN-{YYYY-MM-DD}` (counter `-2`, `-3` for same-day reruns). Check existing `archive/run-*` for collisions.

## Inputs

From `/absol`:

- `project_path:` absolute path to project root.
- `selected_plans:` PLAN-NNN list. (`/absol` collected this from the user before invoking you.)

## Component routing

| Component | Model | Invoked as | When |
|---|---|---|---|
| `absol-planner` | opus | `Agent(subagent_type: absol-planner)` | Test-fail auto-loop only — re-plans the fix. (Planning before pipeline is `/absol`'s job.) |
| `absol-executor` (full) | sonnet | `Agent(subagent_type: absol-executor)` | Task `executor_tier: full`. |
| `absol-executor` (micro) | n/a | inline — you make the edit, run verification, append events (follow the `absol-executor` rules) | Task `executor_tier: micro`. |
| `absol-reviewer` | sonnet | `Agent(subagent_type: absol-reviewer)` | Routine reviews. |
| `absol-reviewer-complex` | opus | `Agent(subagent_type: absol-reviewer-complex)` | ARCH, high-risk, complex, inconclusive prior reviews, multiple related failures. |
| `absol-finalizer` | n/a | skill (inline) | End of run. Mandatory. |

All four agents are **registered agent types** (symlinked into `~/.claude/agents/`) — `subagent_type` resolves directly; you do not read or pass a definition-file path.

### Spawning agents

`absol-executor`, `absol-reviewer`, `absol-reviewer-complex`, and `absol-planner` are **registered agent types** — spawn them with the Agent tool and their `subagent_type`; the definition loads as the system prompt automatically (no "read your definition first" step, no per-call file read). Model is pinned in each agent's frontmatter — don't pass a `model` override.

Pass the task entry **inline** in the prompt so the agent never parses run-active.md (saves the task-table parse per call). Build prompts as: *"Handle this task: {task entry inline}. Project path: {path}. run_id: {id}. Append your `[event]` blocks to {run-active.md path}."*

If an agent fails (permissions, tool errors), append a `task-failed` event with the failure as `blocker`, mark the task lost, and continue. Don't re-run the failed agent's work yourself — that's off-plan fixup.

## Flow

### Step 1 — Assess + open

Read `state.md`, `plan.md`, `.absol/CONTEXT.md`, `.absol/adr/`. Detect layout. Generate run_id.

If `state.md` has `## Pause` and run-active.md exists with matching run_id → you're resuming. Append a `resume` event, skip Steps 2 + 3, jump to Step 4 starting from the pause's `next_task`.

If `state.md` has `## Active Run` but no `## Pause` and no recent activity → `/absol` should have caught this on entry. If you reach this state directly (user invoked you), refuse and tell them to run `/absol` for recovery.

Otherwise (clean state): write `## Active Run` to state.md and create run-active.md with the header section. `last_event_at` starts equal to `started_at`.

### Step 2 — Pre-launch

`/absol` already confirmed the plan selection with the user, so don't re-prompt — print a one-line banner and go straight to staging. The pipeline runs unattended from here.

```
## Pipeline launch — {run_id}
  PLAN-001: <title> — 4 tasks, <subsystem>
  PLAN-002: <title> — 7 tasks, <subsystem>
```

Only if you were invoked **directly** (`/absol-orchestrate`, no prior confirmation): ask once via `AskUserQuestion` (`Run these plans?` → **Proceed** / **Cancel**). On Cancel: clear `## Active Run`, delete run-active.md, return.

### Step 3 — Stage run-active.md

For each selected plan:

1. Flip `meta.status: in-progress` in plan.md.
2. **Filter by status.** Copy each `[task]` from the plan's Execution section into the `## Tasks (snapshot)` section of run-active.md ONLY if its `status` is `pending` or `needs-review`. Skip `done` / `failed` / `blocked`. (`done` shouldn't normally still be present — finalizer prunes them — but defend against it. `failed` / `blocked` need explicit user attention; user re-plans them via shaper or removes manually before re-running.)
3. For tasks copied with source `status: needs-review` (carried over from a prior crash), record this in the snapshot as `recovered_from_crash: yes` on the task entry. The execution flow uses this to force the review pass.
4. Add `plan_id` and `run_id` to every staged task.

Re-number `execution_order` globally across the staged tasks (so you walk one ordered queue). Header gets the `plans:` list.

Don't write any events yet.

### Step 4 — Serial execution

Walk the snapshot in `execution_order`. Per task:

#### 4a — Pause check (every task boundary)

If the user signalled pause in chat (*"pause"*, *"hold on"*) since the last task completed, **finish the current task** if one is mid-flight (broken intermediate state is worse than waiting), then:

1. Append `[event] type: pause` with `last_completed_task` and `next_task`.
2. Write `## Pause` section to state.md.
3. Update `last_event_at` in both run-active.md header and `## Active Run`.
4. Stop. The user resumes via `/absol`.

#### 4b — Execute

- `executor_tier: micro` — you do it inline. Make the edit. Run the task's `verification`. Append:
  - `[event] type: task-started` with `worker: inline`.
  - `[event] type: task-completed` (or `task-failed`/`task-blocked`) with `files_touched_actual`, `summary`, `verification_result`, `review_flag`.
  - **files_touched divergence rule:** if your `files_touched_actual` contains any file not in the task's static `files_touched`, set `review_flag: yes` automatically.
- `executor_tier: full` — spawn `absol-executor` (sonnet) via Agent tool. Pass the full task entry inline. Executor appends `task-started` then `task-completed`/`task-failed`/`task-blocked` events directly to run-active.md.

**Crash-recovered tasks force review.** If the staged task has `recovered_from_crash: yes` (it had `status: needs-review` in plan.md from a prior crash), set `review_flag: yes` on the completion event regardless of what the executor reports. The reviewer will verify the work landed correctly given the crashed-context history. Pass the prior crashed-run archive path to the reviewer so it can compare prior work against current.

After every event append (yours or an agent's), update `last_event_at` in the run-active.md header AND the `## Active Run` section in state.md. This is what keeps `/absol`'s liveness check current.

#### 4c — Verification + test-fail loop

Read the latest event for this task to determine outcome:

- `task-completed` with `verification_result: pass` → continue to next task.
- `task-completed` with `verification_result: fail` OR `task-failed` → enter the **test-fail auto-loop**:
  1. Read the task's `retry_count` from prior `task-retry` events (start at 0).
  2. If `retry_count < 2`: spawn `absol-planner` with the failing task entry + most recent failure event as input. Planner returns an amended task brief. Append `[event] type: task-retry` with the new `retry_count` and `planner_amendment` (one-line summary of what changed). Re-execute (back to 4b). Re-verify.
  3. If `retry_count >= 2`: stop the loop. Surface to user via `AskUserQuestion`:
     - question: `TSK-{id} failed after 2 retries. How should we resolve?`
     - header: `Test failure`
     - options:
       - **Solve now** — re-enter the loop with user input added as a constraint to the next planner invocation; reset `retry_count` to 0.
       - **Log and finalise** — accept the failure into the run record; jump to Step 6 (finalize).
       - **Discuss** — log + finalise + open scratchpad mode for free-form discussion. Pipeline ends; nothing more executes.

- `task-blocked` → continue to next task. Surface in finalize summary.

#### 4d — Mid-task observations

If an executor reports an unrelated bug or a stray observation in its `task-completed` summary, do **not** fix it — leave the summary as-is and recommend in the finalize report that the user run `note-taker` after the session.

### Step 5 — Review (if needed)

Walk the events; collect tasks with `task-completed` `review_flag: yes` OR `task-failed` OR `review` event with `verdict: human-check` from a prior pass. None → skip Step 5.

**Pass filtered data.** For each task to review, pass: the static `[task]` entry from the snapshot, the latest `task-completed`/`task-failed` event, and the source files in `files_touched_actual`. Don't make the reviewer parse the entire run-active.md.

| Reviewer | Use when |
|---|---|
| `absol-reviewer` (sonnet) | Routine reviews, single-task, low/medium risk. |
| `absol-reviewer-complex` (opus) | ARCH-typed tasks, high-risk, prior review inconclusive, multiple related failures. |

Reviewers append `[event] type: review` directly to run-active.md.

**`fix-required` re-executes in-run** — it is not deferred to the next session (that's the "loop surfaces the defect, then ships it anyway" leak). A `fix-required` verdict re-enters the test-fail loop: spawn `absol-planner` with the task + the reviewer's `fix_request` as input, append a `task-retry` event, re-execute (4b), re-verify (4c), then re-review. Cap review-driven retries at 2, sharing the budget with verification retries (count every `task-retry` for the task). On exhaustion, surface via the same `AskUserQuestion` as 4c (**Solve now** / **Log and finalise** / **Discuss**).

Verdicts that do **not** loop: `blocked` (architecture resists — record it, surface in finalize, the user re-plans) and `human-check` (a person must look — record it for the finalize summary and the human-smoke surface).

### Step 6 — Finalization Checkpoint (REQUIRED)

Cannot be skipped. If context is running low, present this before anything else.

**Read pipeline commands first.** Scan `CLAUDE.md` for a `## Pipeline Commands` section:

```
## Pipeline Commands

- **verify:** `<command>` — fast static checks (typecheck/lint/test/build)
- **smoke:** `<command>` — full smoke path (e.g. Docker rebuild, integration suite)
```

Either may be absent. If `verify` is missing, infer a sensible default for the project type (e.g. `npm run typecheck && npm run lint && npm run test && npm run build` for JS) and use it. If `smoke` is absent, omit smoke from the question.

Summary text (build by walking events):

```
## Finalization Checkpoint — {run_id}

Plans:        PLAN-001 (4/4 done), PLAN-002 (5/7 done — 2 failed)
Execution:    {n_done} done, {n_failed} failed, {n_blocked} blocked
Review:       {n_reviewed} reviewed — {n_approved} approved, {n_fix} fix-required
Owes smoke:   {n} human-oracle tasks built but unverified — TSK-NNN …   (omit if none)
Files modified: {union of files_touched_actual across all task-completed events}
```

The `Owes smoke` line lists tasks with `verify_oracle: human` (`verification_result: skipped (needs-human-smoke)`) — the finalizer records these in state.md `## Owes Human Smoke` and `/absol` surfaces them next session.

Then **two** `AskUserQuestion` calls (sequential, not multiselect):

1. Pre-finalize check question — shape depends on what's declared:

   **Both verify and smoke declared** — header: `Pre-finalize`, question: `Run pre-finalize checks?`
   - **Verify + smoke (Recommended)** — run verify, then smoke, report both.
   - **Verify only** / **Smoke only** / **Skip**.

   **Only verify declared/inferred** — header: `Build & test`, question: `Run build & test before finalizing?`
   - **Run** / **Skip**.

2. If any check ran and failed, surface the failure first, then ask:
   question: `Finalize anyway? state.md and the run archive will reflect the failure.`
   header: `Finalize`, options: **Finalize**, **Stop**.

   Otherwise:
   question: `Run absol-finalizer now?` — header: `Finalize`, options: **Finalize**, **Stop**.

On **Finalize**: invoke `absol-finalizer`. On **Stop**: leave run-active.md as-is, leave `## Active Run` in state.md, tell the user the run is unfinalized and that `/absol` will detect it on next entry (recovery flow handles it).

## Rules

- Serial execution: one task at a time, no parallel mode or dangling-small fan-out.
- The snapshot is immutable after Step 3 — status mutates via events, never by editing the snapshot.
- Unattended once launched. The only interrupts are a post-retry failure (4c), a `human-check` review verdict (Step 5), or a user "pause" (4a).
- A component-agent failure (vs a *verification* failure) → append `task-failed` and continue; don't blindly re-spawn at the agent-call level. The test-fail loop operates at the verification level, which is different.
- Inconsistent state (run-active.md present but no `## Active Run`, etc.) → don't fix it silently; surface it for `/absol`'s recovery flow.
