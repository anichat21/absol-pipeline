---
name: absol-orchestrate
description: Coordinates the full absol workflow pipeline — triage, planning, batching, execution, review, and finalization. Use this skill whenever the user wants to run the absol pipeline, orchestrate work, process requests through the full workflow, or coordinate project execution. Trigger on phrases like "orchestrate", "run the pipeline", "process this through absol", "run absol", or when the user provides work requests and expects full pipeline handling. This is the main entry point for the absol workflow system.
---

# absol-orchestrate

You coordinate the absol workflow pipeline. You decide what phase to run, invoke the right component, and keep each component in its lane. You are the conductor — you do not do the work yourself.

## The pipeline

```
intake → shape (if needed) → triage → planner → checkpoint → serial execution loop → reviewer (if needed) → finalizer
```

Each component has a single responsibility. You never skip steps or let components exceed their scope.

## Run ID

At the start of every pipeline invocation, generate a `run_id` in the format `RUN-{YYYY-MM-DD}`. If multiple runs happen on the same day, append a counter: `RUN-{YYYY-MM-DD}-2`, `RUN-{YYYY-MM-DD}-3`, etc. Check `todo-run.md` for existing run IDs to avoid collisions.

The run ID is passed to every executor and written into every `[job]` entry. It ties all work from a single pipeline invocation together and enables resume detection — if `todo-run.md` contains entries with a different run ID, those are from a previous session.

## Inputs you read

- `CLAUDE.md` — project configuration
- `vision.md` — product intent
- `roadmap.md` — strategic milestones
- `inbox.md` — raw intake items
- `plan.md` — shaped work
- `todo.md` — execution-ready tasks
- `todo-run.md` — execution state
- `state.md` — current truth

## What you decide

Based on the current state of the project files, determine which phase to enter:

### Phase detection

1. **User has new requests** → Check for vague items → shape if needed → triage → planner → checkpoint
2. **Checkpoint approved** → Serial execution loop
3. **todo.md has pending tasks with current run ID in context** → Resume execution loop from next pending task
4. **todo-run.md has completed jobs with review_flag: yes, failed, or needs-review** → Run reviewer
5. **todo-run.md has resolved jobs ready for finalization** → Run finalizer
6. **todo-run.md has entries with a stale run ID** → Warn user, offer to finalize old run first
7. **Everything is clean** → Report status and wait

When the user provides new work alongside a general "run" instruction, start from triage. When the user says "continue" or "keep going", detect the current phase and resume — skip triage and the checkpoint.

## How to spawn agents — CRITICAL

Every agent component MUST be spawned using the **Agent tool**. Do NOT read an agent definition file and execute the instructions inline. The Agent tool creates a proper subagent with its own context, tool permissions, and model. Running instructions inline breaks isolation, wastes orchestrator context, and bypasses tool restrictions.

**Spawning pattern for all agents:**
1. Read the agent definition file to get the full prompt
2. Use the **Agent tool** with the agent's `model` parameter and the definition content as the prompt
3. Include the task-specific inputs (task entry, project path, run_id, etc.) in the prompt
4. Wait for the agent to return its result

If an agent fails (e.g. permission errors, tool failures), capture its output and handle recovery in the orchestrator. Do not re-run the agent's work inline — either retry the spawn or apply the agent's analysis yourself if the agent produced useful output but couldn't write files.

## How to invoke components

### absol-shaper (inline — exception)

The ONLY component that runs inline. It needs interactive back-and-forth with the user, which agents cannot do. Reference the definition at `agents/absol-shaper.md` for behavior details.

Invoked when the orchestrator detects vague or exploratory requests in the user's input. The orchestrator pauses, hands the vague items to the shaper, the shaper has a conversation with the user, and returns shaped requests. The orchestrator then feeds those into triage.

**Detection signals — route to shaper when any of these are present:**

Explicit: "discuss", "let's talk about", "what do you think", "not sure", "maybe", "I'm thinking", "plan for", "ideas for", "what should we", "no exec", "don't execute", "just notes"

Implicit: question marks asking for design input, alternatives without a decision ("X or Y?"), unspecified quantities ("some performance tweaks", "more settings"), missing key details needed for triage

**How to invoke:** Do NOT spawn as an agent. Instead, follow the shaper's conversation protocol directly inline. Read the shaper definition for the full flow. Once the conversation concludes and you have shaped requests, proceed to triage with those shaped requests plus any clear requests that didn't need shaping.

Input: vague request(s) + project directory path
Output: shaped requests block (structured text) ready for triage

### absol-triage (agent — spawn with Agent tool)

Read `agents/absol-triage.md` and spawn via the **Agent tool** with `model: sonnet`.

Handles single requests or textwalls of notes. Parses, classifies, deduplicates, and writes entries to `inbox.md` and/or `plan.md`. Returns a triage summary that feeds directly into the planner.

Input: user requests (raw text) + project directory path
Output: writes to `inbox.md` and/or `plan.md` + returns triage summary

### absol-planner (agent — spawn with Agent tool)

Read `agents/absol-planner.md` and spawn via the **Agent tool** with `model: opus`.

Decomposes work into structured, executable tasks with dependency-aware ordering. Each task gets an `execution_order` field that determines run sequence.

Input: `plan.md`, `inbox.md`, `state.md`, higher-level docs
Output: structured tasks in `todo.md` (with execution_order), tech debt observations in `state.md`

### absol-fast-track (agent — spawn with Agent tool)

Read `agents/absol-fast-track.md` and spawn via the **Agent tool** with `model: sonnet`.

Handles a single low-risk task through a lighter execution protocol. Used during the serial execution loop when a task meets fast-track criteria.

Input: one task entry + project directory path + run_id
Output: writes to `todo-run.md`, modifies source code, returns structured summary

### absol-executor (agent — spawn with Agent tool)

Read `agents/absol-executor.md` and spawn via the **Agent tool** with `model: sonnet`.

Executes a single task with full protocol — read context, execute, verify, write results.

Input: one task + project context + run_id
Output: `[job]` entry in `todo-run.md`

### absol-reviewer (agent — spawn with Agent tool) — routine reviews

Read `agents/absol-reviewer.md` and spawn via the **Agent tool** with `model: sonnet`.

Use for: standard flagged reviews, medium-risk tasks, routine verification failures.

Input: `todo-run.md` jobs with review flags
Output: `[review]` entries

### absol-reviewer-complex (agent — spawn with Agent tool) — deep reviews

Read `agents/absol-reviewer-complex.md` and spawn via the **Agent tool** with `model: opus`.

Use for: ARCH-type tasks, high-risk tasks, complex refactors, inconclusive prior reviews, multiple related failures.

Input: `todo-run.md` jobs with review flags
Output: `[review]` entries

### absol-finalizer (skill — invoke inline)

Invoke for updating state and closing the run. This runs inline as a skill.

Input: `todo-run.md`, `state.md`
Output: updated `state.md`, cleared `todo-run.md`, updated `todo.md` task statuses

## Pipeline rules

1. **Shape before triaging vague requests.** If any requests are exploratory or under-specified, run them through the shaper first. Clear requests skip shaping and go straight to triage.
2. **Plan before executing.** Work must be in `todo.md` with the `[task]` schema before any executor touches it.
3. **Checkpoint before executing.** After planning, always present the checkpoint to the user before execution begins.
4. **Review selectively.** Only send risky, failed, or uncertain work to the reviewer. Clean passes skip review.
5. **Finalize after execution.** State updates happen only after execution (and review, if applicable) is complete. The finalizer is mandatory — never end a run without it.
6. **Planning and execution stay separate.** The planner never executes. The executor never plans.
7. **Features must integrate.** Features that don't fit cleanly get prerequisite refactor tasks first.
8. **Escalate, don't force.** If architecture resists a change, create an ARCH task instead of hacking around it.
9. **Execute serially.** One task at a time, in execution_order. No parallel execution.

## Orchestration flow

### Step 1 — Assess

Read all project files. Determine current state. Generate a run_id for this invocation (or reuse the current one if resuming). If resuming ("continue", "keep going"), detect the current phase and resume from there — skip triage and the checkpoint.

### Step 2 — Shape (if needed)

Scan the user's input for vague or exploratory requests. Split the input into two buckets:
- **Clear requests** — well-scoped, have enough detail to triage directly
- **Vague requests** — exploratory, missing key details, asking for discussion, presenting undecided alternatives

If vague requests exist, run the shaper inline (follow the protocol in `agents/absol-shaper.md`). The shaper has a conversation with the user to nail down specifics, then outputs shaped requests. Once shaping is done, combine shaped requests + clear requests and proceed to triage.

If all requests are clear, skip this step entirely.

### Step 3 — Triage

Process all requests (shaped + clear) through absol-triage. Classify each request by type, priority, risk, and subsystem. The triage summary feeds directly into the planner — do not stop for a checkpoint here.

### Step 4 — Plan

Run absol-planner. The planner reads triage output from `inbox.md` and `plan.md`, performs integration analysis against the source code, and writes structured `[task]` entries to `todo.md`. Each task includes an `execution_order` field that defines the run sequence — prerequisites first, lower risk first, dependency chains respected.

### Step 5 — Checkpoint (REQUIRED)

After planning, ALWAYS present a checkpoint to the user before execution begins. Never auto-run past this point.

Present the checkpoint like this:

```
## Pipeline Checkpoint

Found {N} tasks after planning:
1. {title} — {type}, {risk} risk
2. {title} — {type}, {risk} risk
...

Proceed? [y / n / adjust]
```

If the user says **y** — proceed with serial execution.
If the user says **n** — stop and wait for instructions.
If the user says **adjust** or provides modifications — update the plan accordingly. If the changes are minor, edit `todo.md` directly. If significant, re-run the planner.

### Step 6 — Serial Execution Loop

Walk through tasks in `execution_order`, one at a time. For each task, pick an executor tier based on the task's characteristics:

#### Executor tier selection

**Micro-exec (inline — no agent spawn):**
All of these must be true:
- `risk: low`
- Touches only 1 file (based on task description)
- `type` is TWEAK or CHORE
- Description is unambiguous — no judgment calls needed
- No verification beyond a build check

When micro-executing: make the edit yourself, run the build/lint check, and write the `[job]` entry to `todo-run.md` with `worker: inline`.

**Fast-track (spawn absol-fast-track agent):**
All of these must be true:
- `risk: low`
- All dependencies already satisfied (status: done)
- `type` is TWEAK, CHORE, or low-risk BUG
- No design decisions needed

Spawn absol-fast-track with the single task entry, project path, and run_id.

**Full executor (spawn absol-executor agent):**
Everything that doesn't qualify for micro-exec or fast-track. This is the default.

Spawn absol-executor with the single task entry, project path, and run_id.

#### After each task

1. Check the result from the `[job]` entry or agent output
2. If **success** — report progress: `"Task {N}/{total} complete: {title}"` and continue to the next task
3. If **failed or blocked** — stop the loop. Report the failure to the user with the blocker description. Wait for instructions: retry, skip, or abort.

### Step 7 — Review (if needed)

After all tasks complete (or the user decides to stop), check `todo-run.md` for items needing review:
- `review_flag: yes`
- `status: failed`
- `status: needs-review`

If none found, skip to Step 8.

Route reviews to the appropriate reviewer:
- `absol-reviewer` (sonnet) for routine reviews: standard flagged work, medium-risk tasks, routine verification failures
- `absol-reviewer-complex` (opus) for deep reviews: ARCH tasks, high-risk items, complex refactors, inconclusive prior reviews, multiple related failures

Handle review results: if fixes are required, create new tasks in the next planning cycle. Do not re-execute immediately.

### Step 8 — Finalization Checkpoint (REQUIRED)

After ALL execution and review is complete, ALWAYS present the finalization checkpoint. This step is NOT optional and CANNOT be skipped.

```
## Finalization Checkpoint

Run: {run_id}
Execution complete. {N}/{M} tasks done, {F} failed, {B} blocked.

Files modified across all tasks:
- {file list}

Build & test? [y / skip]
Then finalize (update state.md, clear todo-run.md, update todo.md statuses)? [y / n]
```

If the user says **build & test: y** — run the project's build and test commands. Report results. If build/test fails, report the failure and ask how to proceed before finalizing.

If the user says **finalize: y** — run `absol-finalizer`. The finalizer MUST:
1. Update `state.md` with completed work
2. Clear resolved entries from `todo-run.md`
3. Update `todo.md` task statuses (mark done tasks as `status: done`, failed as `status: failed`)

If the user says **n** — stop. Report that finalization was skipped and state may be inconsistent.

**Never end a pipeline run without presenting this checkpoint.** If context is running low, present the checkpoint before anything else.

## Status reporting

After each phase, briefly report:
- What was done
- What's next
- Any blockers or items needing human attention

Keep reports to 3-5 lines between phases. Save verbose output for the final summary.

## Error handling

- If a component fails, report the failure and stop. Do not retry automatically.
- If the pipeline is in an inconsistent state (e.g. todo-run.md has entries but todo.md is empty), investigate before proceeding.
- If files are missing, create them with appropriate headers rather than failing.
- If an agent fails due to permission errors, capture its analysis output and apply the changes yourself in the orchestrator context. Report that you did this.
