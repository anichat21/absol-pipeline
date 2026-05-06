---
name: absol
description: Entry point for the absol workflow. Opens an absol session on a named project, prints a brief status, then watches the conversation and routes work to one of three modes — note-taker (dumping observations), scratchpad (adhoc fixes), or pipeline (formal planner→executor→reviewer→finalizer flow). Also enforces the pause lock — if a previous pipeline was paused mid-run, blocks scratchpad and new pipelines until the pause is resolved or finalized-away. Use whenever the user says '/absol', '/absol &lt;project&gt;', 'open absol on X', 'start an absol session', 'work on &lt;project&gt;', or whenever you want to begin or continue work on a project that uses the absol pipeline.
---

# absol

Front door for an absol project session. Three jobs:

1. **Open the project.** Locate it, print a tight status banner.
2. **Enforce the pause lock.** If the project has an unresolved pipeline pause, gate everything until the user resolves it.
3. **Watch the conversation and route to one of three modes** as user intent emerges:

| Mode | Trigger | What happens |
|---|---|---|
| **note-taker** | User dumps observations / "I noticed X" / "feature idea: Y" | Invoke `note-taker` skill; routes to inbox/bugs/tech-debt |
| **scratchpad** | "Let's fix X" / "how does Y work" / specific adhoc work | Invoke `absol-scratchpad` skill |
| **pipeline** | "Run the pipeline" / "let's churn" / "execute the plan" | Activate planner (if plan.md is light) then `absol-orchestrate` |

The pipeline is **opt-in** — adhoc work never silently triggers it. That's what scratchpad exists for. The user picks the mode by what they say; you don't need to ask.

## Entry

User says `/absol <project>` or `/absol` with the project mentioned in conversation. Resolve the project:

1. Look at `/mnt/nas/dev/projects/<project>/` — match exact name.
2. If not found, list `/mnt/nas/dev/projects/` and ask which one — don't guess.
3. cd into that path. All subsequent file paths are relative to it.

If there's no `.absol/` folder, the project hasn't been migrated. Tell the user *"This project is on the legacy flat layout — run `/absol-migrate` to upgrade before opening absol."* and stop.

## Status banner (print on entry)

Read `state.md`, count entries in `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`. Output a short banner:

```
absol — <project>

Last session: <one line from state.md "Last Session">
In progress:  <one line from state.md "In Progress" or "nothing">
Plans ready:  N (PLAN-001, PLAN-002, …)        ← omit if zero
Inbox:        N notes (M shaped)                ← M = count with shaper_notes
Bugs:         N
Tech debt:    N
Pause:        none | RUN-XXX paused at TSK-NNN  ← see Pause Lock below
```

Keep it tight — six lines, scannable. Don't dump full file contents.

## Pause Lock

**Before doing anything else**, check `state.md` for a `## Pause` section. If present, the project is mid-pipeline and frozen.

Show the pause details and offer the user three options via `AskUserQuestion`:

- question: `Project is paused mid-pipeline. How do you want to proceed?`
- header: `Pause`
- options:
  - **Resume** — re-enter `absol-orchestrate` from the next-task pointer in the pause record.
  - **Finalize away** — accept the partial run as-is; invoke `absol-finalizer` on what completed; clear the pause section.
  - **Cancel** — exit absol; user wants to do something outside the pipeline first.

Until the user picks Resume or Finalize, **block** scratchpad mode and **reject** new pipeline activations. The reason: scratchpad edits would corrupt state that the paused pipeline expected. One pipeline at a time.

note-taker is allowed during a pause — capturing thoughts doesn't touch executable state.

## Mode routing — how to decide

You are watching the conversation; the user is not picking modes by name. Match intent:

**note-taker mode** — the user is *capturing*, not asking you to act:
- "note that X is broken"
- "feature idea: Y"
- "we should clean up Z"
- "log a todo for…"
- *"I noticed the auth flow has a race"*

Invoke the `note-taker` skill. Continue the conversation after — note-taker confirms with one line and returns control.

**scratchpad mode** — the user wants something *done now*, but it's discrete adhoc work, not a formal plan:
- "let's fix the typo in src/auth.ts"
- "how does the cache invalidation work"
- "pull BUG-017 and fix it real quick"
- *"can you change the button colour"*

Invoke `absol-scratchpad`. It opens a session, executes the work, logs it to `todo-run.md` with `worker: scratchpad`, then closes.

**pipeline mode** — the user wants the full machinery:
- "run the pipeline"
- "let's churn through inbox"
- "execute the next plan"
- *"orchestrate this"*

See **Pipeline activation** below. Don't jump straight to `absol-orchestrate` — there's a planning step first if plans are thin.

When the user's intent isn't clear, ask. *"Want me to log that as a note, or fix it now in scratchpad?"* Don't silently pick.

## Pipeline activation

When pipeline mode is requested:

1. **Check plan.md.** Parse PLAN-NNN entries with `status: ready`.

2. **Decide whether to plan first:**

   - **Plans ready, user said "execute the plan"** → skip planning, go straight to step 4.
   - **Plans ready, but inbox/bugs/tech-debt has substantial unplanned work** → ask user via `AskUserQuestion`:
     - question: `Pipeline activation — planning step?`
     - header: `Pipeline`
     - options:
       - **Use existing plans only** — skip planning, run what's in plan.md.
       - **Add inbox items first** — run planner on selected seeds, then run.
       - **Cancel** — abort pipeline activation.
   - **No plans ready** → must plan first. Ask user which seeds to plan from inbox/bugs/tech-debt (offer multiselect). If no seeds either, tell the user the project has nothing to do; stop.

3. **Plan if asked.** This is where seed grouping happens:

   - **Selected seeds all share subsystem (cheap inline check on the `subsystem` field)** → spawn one `absol-planner` agent with all seeds.
   - **Selected seeds span multiple subsystems** → spawn a sonnet triage subagent for grouping (see Triage subagent below). Then spawn one `absol-planner` per resulting group, in parallel (clusters are subsystem-disjoint, no cross-contamination).

   Each planner appends a PLAN-NNN entry to `plan.md` and flips its consumed seeds to `status: promoted`.

4. **Hand off to `absol-orchestrate`.** Pass the project path. Orchestrate's pre-launch checkpoint shows plan.md and asks the user which plans to execute this run.

## Triage subagent

Used when selected seeds need grouping. Inline heuristic: if all seeds share `subsystem`, no triage needed — single planner call.

Otherwise spawn a sonnet subagent:

```
Agent({
  subagent_type: "general-purpose",  # or a dedicated triage agent if added later
  model: "sonnet",
  prompt: "You are a triage agent for the absol pipeline.

  Group these seeds into cohesive clusters by shared subsystem and likely
  file overlap. Each cluster becomes one planner invocation, so members
  must share a fix.

  Seeds:
  - INBOX-042: <title>, subsystem: <sub>, description: <one line>
  - BUG-017: ...
  - DEBT-008: ...

  Return JSON: [{cluster_id: 1, seed_ids: [...], rationale: '...'}, ...].
  Singletons (one seed per cluster) are fine — better than forcing weak grouping."
})
```

Trust its output. If a planner later refuses-and-resplits a cluster, accept that and re-invoke as singletons.

## Test-fail loop (when orchestrate surfaces a failure)

`absol-orchestrate` runs its own test-fail auto-loop (2 retries through planner→executor). When the loop exhausts without resolution, it surfaces back to you. Show the failure and use `AskUserQuestion`:

- question: `Test failures persist after 2 retries on TSK-NNN. How should we resolve?`
- header: `Test failure`
- options:
  - **Solve now** — re-enter the planner→executor loop with the user's input added as a constraint.
  - **Log and finalise** — accept the failure into the run record; invoke `absol-finalizer`; close the pipeline.
  - **Discuss** — log + finalise + open scratchpad mode for free-form discussion. (Nothing further executes in pipeline.)

## When the user wants to pause

If the user says *"pause"*, *"hold on"*, *"stop the pipeline"* mid-run:

1. Tell `absol-orchestrate` to finish the **current** task (don't kill it — broken intermediate state is worse than waiting 30 seconds).
2. After current task lands, write `## Pause` section to `state.md`:
   ```
   ## Pause

   - run_id: RUN-2026-05-06
   - paused_at: 2026-05-06T14:32:00
   - last_completed_task: TSK-004
   - next_task: TSK-005
   - reason: user-requested
   ```
3. Tell the user the pause is in place. Offer Resume / Finalize-away / Cancel via `AskUserQuestion` — same options as the pause-lock check on entry.

## Rules

- Three modes; you pick one per turn based on user intent. Never run two simultaneously.
- Pause lock is non-negotiable. If `## Pause` is in state.md, scratchpad and new pipelines are blocked.
- Don't silently jump into pipeline mode. The user must explicitly want it.
- You don't write to state.md or any .absol/ data file directly — you delegate to note-taker, scratchpad, planner, orchestrate, finalizer. (Exception: writing the `## Pause` section to state.md when handling a user-requested pause; clearing it on resume.)
- Don't re-invoke a mode that's already running. If scratchpad is mid-session, finish it first.
- Status banner is six lines, not a status report. The user asked for a session, not a project audit.
