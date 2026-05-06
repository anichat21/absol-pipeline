---
name: absol
description: Entry point for the absol workflow. Opens an absol session on a named project, prints a brief status, runs recovery if a previous run crashed or paused, then watches the conversation and routes work to one of three modes — note-taker (dumping observations), scratchpad (adhoc fixes), or pipeline (formal planner→executor→reviewer→finalizer flow). The only supported front door for the pipeline; absol-orchestrate is internal and should not be invoked directly. Use whenever the user says '/absol', '/absol &lt;project&gt;', 'open absol on X', 'start an absol session', 'work on &lt;project&gt;', or whenever you want to begin or continue work on a project that uses the absol pipeline.
---

# absol

Front door for an absol project session. Three jobs:

1. **Open the project.** Locate it, run recovery if needed, print a tight status banner.
2. **Enforce locks** — no second session if one is live; offer recovery if a previous one crashed; offer Resume/Finalize-away if paused.
3. **Watch the conversation and route to one of three modes** as user intent emerges:

| Mode | Trigger | What happens |
|---|---|---|
| **note-taker** | User dumps observations / "I noticed X" / "feature idea: Y" | Invoke `note-taker` skill; routes to inbox/bugs/tech-debt |
| **scratchpad** | "Let's fix X" / "how does Y work" / specific adhoc work | Invoke `absol-scratchpad` skill |
| **pipeline** | "Run the pipeline" / "let's churn" / "execute the plan" | Activate planner (if plan.md is light) then `absol-orchestrate` |

The pipeline is **opt-in** — adhoc work never silently triggers it. That's what scratchpad exists for. The user picks the mode by what they say; you don't need to ask unless intent is ambiguous.

## Entry

User says `/absol <project>` or `/absol` with the project mentioned in conversation. Resolve the project:

1. Look at `/mnt/nas/dev/projects/<project>/` — match exact name.
2. If not found, list `/mnt/nas/dev/projects/` and ask which one — don't guess.
3. cd into that path. All subsequent file paths are relative to it.

If there's no `.absol/` folder, the project hasn't been migrated. Tell the user *"This project is on the legacy flat layout — run `/absol-migrate` to upgrade before opening absol."* and stop.

## Recovery check (BEFORE the banner)

Read `state.md` and check for `## Active Run` and `## Pause` sections. Check existence of `.absol/run-active.md`. Apply the recovery state matrix:

| `## Active Run` | `## Pause` | `run-active.md` | `last_event_at` | Verdict |
|---|---|---|---|---|
| absent | absent | absent | — | **Clean** — proceed to banner |
| present | absent | present | < 15 min ago | **Live elsewhere** — refuse |
| present | absent | present | > 15 min ago | **Crashed** — recover (below) |
| present | present | present | any | **Paused** — recover (below) |
| present | absent | absent | — | **State drift** — offer Force-clear active run |
| absent | absent | present | any | **State drift** — offer Force-clear orphaned run-active.md |

For the **Live elsewhere** verdict: tell the user another absol session is active in this project (last event {N} minutes ago) and refuse to open a second one. They should either go back to that session or wait for it to crash past the 15-min threshold.

For **Crashed**: show the active-run details (run_id, mode, last_completed_task, last_event_at) and use `AskUserQuestion`:

- question: `Previous run appears to have crashed. How to proceed?`
- header: `Recovery`
- options:
  - **Resume** — re-enter `absol-orchestrate` from the next-task pointer (orchestrator walks events to determine next-task if not explicitly recorded).
  - **Finalize away** — accept what completed; invoke `absol-finalizer` on the partial run; clean up.
  - **Discard** — delete `run-active.md`, clear `## Active Run` in state.md, lose the in-flight events. Use only when the run was clearly bogus.

For **Paused**: same options minus Discard (pause is intentional — the user shouldn't lose data).

For **State drift** verdicts: surface the inconsistency and offer Force-clear with `AskUserQuestion` (Force-clear / Cancel). Don't silently fix.

Until the user picks a recovery option, **block** scratchpad and **reject** new pipeline activations. note-taker is allowed (capturing thoughts doesn't touch executable state).

## Status banner (after recovery is resolved)

Read `state.md`, count entries in `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`. Output a short banner:

```
absol — <project>

Last session: <one line from state.md "Last Session">
In progress:  <one line from state.md "In Progress" or "nothing">
Plans ready:  N
  - PLAN-001 (created 2026-04-25, 11d old — may need re-planning against current codebase)
  - PLAN-002 (created 2026-05-04)
  - PLAN-003 (created 2026-05-06)
Inbox:        N notes (M shaped)
Bugs:         N
Tech debt:    N
```

The plan staleness flag fires when a plan's `created` date is more than **5 days** old — older plans may need re-planning against the current codebase. It's a soft hint, not a block. Omit the date detail when no plans are stale (just `Plans ready: N (PLAN-001, PLAN-002, …)`).

Six-to-ten lines. Don't dump full file contents.

## Mode routing — how to decide

You are watching the conversation; the user is not picking modes by name. Match intent:

**note-taker mode** — the user is *capturing*, not asking you to act:
- "note that X is broken"
- "feature idea: Y"
- "we should clean up Z"
- "log a todo for…"

Invoke the `note-taker` skill. Continue the conversation after — note-taker confirms with one line and returns control.

**scratchpad mode** — the user wants something *done now*, but it's discrete adhoc work, not a formal plan:
- "let's fix the typo in src/auth.ts"
- "how does the cache invalidation work"
- "pull BUG-017 and fix it real quick"

Invoke `absol-scratchpad`.

**pipeline mode** — the user wants the full machinery:
- "run the pipeline"
- "let's churn through inbox"
- "execute the next plan"

See **Pipeline activation** below. Don't jump straight to `absol-orchestrate` — there may be a planning step first if plans are thin.

When the user's intent isn't clear, ask. *"Want me to log that as a note, or fix it now in scratchpad?"* Don't silently pick.

## Pipeline activation

When pipeline mode is requested:

1. **Check plan.md.** Parse PLAN-NNN entries with `status: ready`.

2. **Decide whether to plan first:**

   - **Plans ready, user said "execute the plan(s)"** → skip planning, go to step 4.
   - **Plans ready, but inbox/bugs/tech-debt has substantial unplanned work** → ask via `AskUserQuestion`:
     - question: `Pipeline activation — planning step?`
     - header: `Pipeline`
     - options:
       - **Use existing plans only** — skip planning, run what's in plan.md.
       - **Add inbox items first** — run planner on selected seeds, then run.
       - **Cancel** — abort.
   - **No plans ready** → must plan first. Ask user which seeds to plan from inbox/bugs/tech-debt (offer multiselect). If no seeds either, tell the user the project has nothing to do; stop.

3. **Plan if asked.** This is where seed grouping happens:

   - **Selected seeds all share `subsystem`** → spawn one `absol-planner` agent with all seeds.
   - **Selected seeds span multiple subsystems** → spawn the **triage subagent** (see below) for grouping. Then spawn one `absol-planner` per resulting group, in parallel (clusters are subsystem-disjoint, no cross-contamination).

   Each planner appends a PLAN-NNN entry to `plan.md` and flips its consumed seeds to `status: promoted`. **If a planner returns `verdict: human-required`** (it sees seeds that don't share a fix), see **Bad-grouping handling** below before continuing.

4. **Hand off to `absol-orchestrate`.** Pass the project path + the list of selected PLAN-NNN to execute. Orchestrate's pre-launch checkpoint shows them and confirms before staging.

## Triage subagent

Used when selected seeds need grouping. Inline heuristic first: if all seeds share `subsystem`, no triage needed — single planner call.

Otherwise spawn a haiku subagent (cheap, fast, sufficient for classification):

```
Agent({
  subagent_type: "general-purpose",
  model: "haiku",
  prompt: "You are a triage agent for the absol pipeline. Group these seeds
  into cohesive clusters by shared subsystem and likely file overlap.
  Each cluster becomes one planner invocation, so members must share a fix.

  Use the project's domain vocabulary verbatim — read .absol/CONTEXT.md
  at this path: {project_path}/.absol/CONTEXT.md

  Seeds:
  - INBOX-042: <title>, subsystem: <sub>, description: <one line>
  - BUG-017: ...
  - DEBT-008: ...

  Return JSON: [{cluster_id: 1, seed_ids: [...], rationale: '...'}, ...].
  Singletons (one seed per cluster) are fine — better than forcing weak grouping."
})
```

Trust its output. If a planner later returns `human-required` on a cluster, that's the safety net.

## Bad-grouping handling (planner human-required verdict)

When a planner returns `verdict: human-required` with a recommended regrouping:

```
## Bad grouping detected

Original cluster: INBOX-042, BUG-017, INBOX-051
Reason: <planner's one-paragraph reason why these don't share a fix>

Suggested regrouping:
  - cluster A: INBOX-042 (auth subsystem)
  - cluster B: BUG-017, INBOX-051 (UI subsystem — both touch toast component)
```

Show this and use `AskUserQuestion`:

- question: `Planner can't find a shared fix for these seeds. How to proceed?`
- header: `Regrouping`
- options:
  - **Accept regrouping** — re-invoke planner once per suggested cluster, in parallel.
  - **All singletons** — re-invoke planner once per seed.
  - **Different split** — user provides their grouping via "Other" free-text.
  - **Cancel pipeline activation** — back out; nothing planned, no plans written.

Don't write the refused plan; don't auto-resplit silently. The user always sees the regrouping decision.

## Test-fail loop surface (when orchestrate exhausts retries)

`absol-orchestrate` runs its own test-fail auto-loop (2 retries through planner→executor). When the loop exhausts, it surfaces back to you with the failure details. Show the failure and use `AskUserQuestion`:

- question: `Test failures persist after 2 retries on TSK-NNN. How should we resolve?`
- header: `Test failure`
- options:
  - **Solve now** — re-enter the loop with the user's input added as a constraint to the next planner invocation.
  - **Log and finalise** — accept the failure into the run record; invoke `absol-finalizer`; close the pipeline.
  - **Discuss** — log + finalise + open scratchpad mode for free-form discussion. Pipeline ends.

## When the user wants to pause

If the user says *"pause"*, *"hold on"*, *"stop the pipeline"* mid-run, signal `absol-orchestrate` (it does the work — finishes the current task, appends a `pause` event, writes `## Pause` to state.md, returns control). Then offer Resume / Finalize-away on next entry via the recovery flow.

## Rules

- Three modes; you pick one per turn based on user intent. Never run two simultaneously.
- Recovery check is non-negotiable. Run it before the banner, every time.
- Don't silently jump into pipeline mode. The user must explicitly want it.
- You don't write to `state.md` or any `.absol/` data file directly — you delegate to note-taker, scratchpad, planner, orchestrate, finalizer. The recovery flow's Force-clear and Discard options are exceptions; in those cases write only the cleanup needed (remove transient sections, delete orphan files).
- Don't re-invoke a mode that's already running.
- Status banner is six-to-ten lines, scannable. The user asked for a session, not a project audit.
- Plan staleness flag fires at >5 days — soft hint only.
- Triage subagent is haiku, with CONTEXT.md in its input. Don't upgrade to sonnet/opus without a strong reason.
- `absol-orchestrate` is internal — invoke only via this skill, not by name in user-facing language.
