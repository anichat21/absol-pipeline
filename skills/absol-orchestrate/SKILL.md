---
name: absol-orchestrate
description: "[INTERNAL] Execution engine for the absol pipeline. Reads plan.md, opens run-active.md, copies the selected plans' tasks into the snapshot section, executes them serially and unattended (test-fail auto-loop, review pass; no HITL pauses), and hands off to absol-finalizer. Does NOT plan, shape, or classify — those happen upstream in note-taker / absol-shaper / absol-planner before this skill runs. Invoked by the /absol entry skill; do NOT trigger directly except when the user explicitly says '/absol-orchestrate'. /absol is the supported front door for all session activity."
---

# absol-orchestrate

Conductor of the execution phase. The plan already exists; your job is to run it. **You do not edit source files. You do not classify intake. You do not design tasks.** Those are owned by note-taker, absol-shaper, and absol-planner respectively, and they run before you.

```
/absol → (plan.md populated by planner/architect) → orchestrate → finalizer
                                                    ↑ you are here
```

You are the only writer of `run-active.md`'s **header** and **Tasks (snapshot)** sections, and of state.md's transient `## Active Run` and `## Pause` sections. Agents (executor, reviewer) only ever **append** `[event]` blocks to run-active.md — they never read or modify it. You pass them their task entry directly in their prompt.

This append-only model exists for two reasons: agents save tokens by not parsing run-active.md, and crash recovery is trivial (run-active.md's existence + state.md `last_event_at` tell `/absol` whether the run is live, paused, or crashed).

## Layout

`.absol/` layout assumed; if absent, fall back to root paths and recommend `/absol-migrate` in the finalize summary.

| Path | Role |
|---|---|
| `state.md` (root) | Truth snapshot. Finalizer-owned, except you write/update transient `## Active Run` + `## Pause` sections. |
| `vision.md`, `roadmap.md`, `CLAUDE.md` (root) | Read-only. |
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

| Component | Mode | Model | Definition path | When |
|---|---|---|---|---|
| `absol-planner` | Agent tool | opus | `~/.claude/agents/absol-planner.md` (top-level — shared with `/absol`, scratchpad escalations, etc.) | Test-fail auto-loop only — re-plans the fix. (Planning before pipeline is `/absol`'s job.) |
| `absol-executor` (full) | Agent tool | sonnet | `agents/absol-executor.md` | Task `executor_tier: full`. |
| `absol-executor` (micro) | inline | n/a | `agents/absol-executor.md` | Task `executor_tier: micro`. You make the edit, run verification, append events directly. |
| `absol-reviewer` | Agent tool | sonnet | `agents/absol-reviewer.md` | Routine reviews. |
| `absol-reviewer-complex` | Agent tool | opus | `agents/absol-reviewer-complex.md` | ARCH, high-risk, complex, inconclusive prior reviews, multiple related failures. |
| `absol-finalizer` | skill (inline) | n/a | `skills/absol-finalizer/SKILL.md` | End of run. Mandatory. |

### Agent self-loading

Build prompts as: *"Read your definition at `{absolute path}` first. Then handle: {task entry inline + project path + run_id}."* Pass the task entry inline so the agent doesn't have to parse run-active.md. Saves both the definition load and the task-table parse per agent call.

If an agent fails (permissions, tool errors), append a `task-failed` event with the failure as `blocker`, mark the task lost, and continue. Don't re-execute the agent's logic inline — you don't edit source files.

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

`fix-required` verdicts feed the next planning cycle. At this point you've exited the test-fail loop — record the verdict, surface in finalize, let the user decide on `/absol` next round.

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
Files modified: {union of files_touched_actual across all task-completed events}
```

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

- You do NOT edit source files. Verification failure → re-spawn executor via the test-fail loop, or mark `task-failed`. The "orchestrator-fixup" pattern is forbidden.
- You do NOT classify intake or design tasks. plan.md is your input; producing it is upstream.
- Serial execution. One task at a time. No parallel mode, no dangling-small fanout.
- Snapshot is immutable after Step 3. Status mutates via events, not by editing the snapshot.
- Update `last_event_at` (in both run-active.md header and state.md `## Active Run`) on every event append. This is non-negotiable — it's how `/absol` distinguishes "live elsewhere" from "crashed."
- No runtime HITL. The pipeline runs unattended once launched; decisions were settled in shaping. Only a post-retry failure, a `human-check` review verdict, or a manual user "pause" interrupts.
- Review selectively. Clean passes skip Step 5.
- Finalize is mandatory. Even on Stop, the unfinalized run is a known recovery state.
- Component agent failure → append `task-failed`, continue. Don't auto-retry blindly at the agent-call level (the test-fail loop is at the verification level, which is different).
- Pause check is at task boundary, not mid-task. Broken intermediate state is worse than waiting one task.
- Inconsistent state (run-active.md present but no `## Active Run` in state.md, etc.) → don't fix silently. Tell the user and let `/absol`'s recovery flow handle it.
