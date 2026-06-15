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
| **scratchpad** | User explicitly says "scratchpad", "quick fix", "real quick", or "adhoc" | Invoke `absol-scratchpad` skill |
| **pipeline** | Everything else — fixing bugs, doing features, "I wanna do X" | Activate planner (if plan.md is light) then `absol-orchestrate` |

**Pipeline is the default.** Scratchpad requires an explicit signal — the user must say "scratchpad", "quick fix", "real quick", or otherwise make it unambiguous they want inline adhoc work. "I wanna do X", "let's fix X", "do the bugs" — all of these go pipeline.

## Entry

User says `/absol <project>` or `/absol` with the project mentioned in conversation. Resolve the project:

1. Look at `/mnt/nas/dev/projects/<project>/` — match exact name.
2. If not found, list `/mnt/nas/dev/projects/` and ask which one — don't guess.
3. cd into that path. All subsequent file paths are relative to it.

If there's no `.absol/` folder, the project hasn't been migrated. Tell the user *"This project is on the legacy flat layout — run `/absol-migrate` to upgrade before opening absol."* and stop.

## Recovery check (BEFORE the banner)

Read `state.md` and check for `## Active Run` and `## Pause` sections. Check existence of `.absol/run-active.md`. Apply the recovery state matrix below. Crashes auto-recover (silently, with a banner notice) — only **Paused** asks the user.

| State | Detection | Handling |
|---|---|---|
| Clean | no Active Run, no Pause, no run-active.md | Proceed to banner |
| Live elsewhere | Active Run + run-active.md + last_event_at < 15 min | Refuse |
| **Crashed** | Active Run + run-active.md + last_event_at > 15 min, no Pause | **Auto-recover** (below) |
| Paused | Active Run + Pause + run-active.md | Ask user |
| State drift A | Active Run, no run-active.md | Auto-clear `## Active Run` |
| State drift B | run-active.md, no Active Run | Auto-archive as crashed, delete file |

### Live elsewhere

Tell the user another absol session appears active (last event {N} minutes ago); refuse to open a second one. They should go back to that session or wait for it to cross the 15-min threshold.

### Crashed (auto)

No prompt. Run the crash protocol:

1. Walk events in run-active.md. For each task in the snapshot:
   - Latest event `task-completed` → mark plan.md task `status: needs-review`.
   - Latest event `task-failed` → mark plan.md task `status: failed`.
   - Latest event `task-blocked` → mark plan.md task `status: blocked`.
   - No terminal event → leave plan.md task `status: pending`.
2. Write `archive/run-{run_id}.md` with `Crashed: yes` in the header. Same archive shape as a clean finalize. (You're effectively running the finalizer's archive step inline; the plan.md update + state cleanup follows the same pattern.)
3. Delete run-active.md.
4. Clear `## Active Run` (and `## Pause` if somehow present) from state.md.

Add a one-line notice to the banner:

> Recovered crashed run: RUN-2026-05-06 (2 done → needs-review, 1 pending). Archived.

The next pipeline run picks up the in-progress plan and handles `needs-review` tasks with mandatory reviewer pass (orchestrator's job).

### Paused (asks)

Show the pause record (run_id, last_completed_task, paused_at) and use `AskUserQuestion`:

- question: `Project is paused mid-pipeline. How to proceed?`
- header: `Pause`
- options:
  - **Resume** — re-enter `absol-orchestrate` from the next-task pointer.
  - **Finalize away** — accept what completed; invoke `absol-finalizer` on the partial run; clean up.

While paused, **block** scratchpad and **reject** new pipeline activations until the user resolves. note-taker is allowed (capturing thoughts doesn't touch executable state).

### State drift A (Active Run with no file)

Nothing was actually running. Just clear `## Active Run` from state.md and proceed. Banner notice:

> Cleared stale `## Active Run` (no run-active.md found).

### State drift B (file with no Active Run)

Orchestrator never finished setting up. Treat the file as a crash:

1. Walk events (if any), archive as `run-{run_id}.md` (with `Crashed: yes` in the header, same as the crash-auto path).
2. Delete run-active.md.

Banner notice:

> Cleared orphaned run-active.md (archived).

## Note hygiene (after recovery, before the banner)

A self-healing pass for **orphaned promoted notes** — a `[note]` with `status: promoted` whose owning work no longer exists. This happens when a plan is removed out of band (manual edit) or, more commonly, when a **scratchpad that pulled a note crashed** — crash recovery archives the run but doesn't demote the note, so it's stuck: invisible to the planner (not `new`) and shown to you as already-handled.

After recovery resolves, scan `inbox.md` / `bugs.md` / `tech-debt.md` for `status: promoted` notes. For each, check `promoted_to`:

- `PLAN-NNN` still present in `plan.md` → leave it (legitimately mid-flight, possibly across runs).
- `SCR-NNN` or `PLAN-NNN` **not** present in `plan.md`, and no Active Run is staging it → **orphan.** Demote: set `status: new`, drop `promoted_to`. If the orphan came from a partial scratchpad and an `archive/run-{id}.md` exists for it, add a `prior_work:` line pointing at that archive so the next planner has the context.

Add a one-line banner notice when anything was demoted:

> Recovered 1 orphaned note: BUG-017 (scratchpad SCR-2026-06-08 crashed) → back to inbox.

This is the only out-of-band note reconciler; without it, orphaned notes accumulate silently.

## Status banner (after recovery is resolved)

Read `state.md`, count entries in `.absol/plan.md`, `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`. **Split note counts by status** — promoted notes are linked to a pending plan and aren't actionable from the user's perspective; only `status: new` notes are available to plan or scratchpad.

```
absol — <project>

Last session: <one line from state.md "Last Session">
In progress:  <one line from state.md "In Progress" or "nothing">
Plans ready:  N
  - PLAN-001 (created 2026-04-25, 11d old — may need re-planning against current codebase)
  - PLAN-002 (created 2026-05-04)
  - PLAN-003 (created 2026-05-06)
Inbox:        N new (+ M shaped, R researched, K promoted)
Bugs:         N new (+ K promoted)
Tech debt:    N new (+ K promoted)
```

The Inbox sub-counts annotate `status: new` notes by enrichment: **shaped** = `shaper_notes` populated (intent locked, ready to plan), **researched** = `research_notes` populated (blast radius mapped). They can co-occur — a note that's both shaped and researched counts in both; that's fine, they're independent enrichments, not a pipeline of states. **Promoted** is `status: promoted` — already attached to a pending plan. Include only the non-zero sub-counts; drop the parenthetical entirely when all are zero (just `Inbox: N`).

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

**scratchpad mode** — only when the user explicitly signals they want inline adhoc work:
- "scratchpad this"
- "fix it real quick"
- "quick fix on src/auth.ts"
- "pull BUG-017 real quick"

The word "scratchpad" or a clear "quick/adhoc" qualifier must be present. Without it, go pipeline.

Invoke `absol-scratchpad`.

**pipeline mode** — the default for any action request that isn't note-taking or explicitly scratchpad:
- "run the pipeline"
- "let's churn through inbox"
- "execute the next plan"
- "fix the bugs" / "do the blender plugin stuff" / "I wanna work on X"

See **Pipeline activation** below. Don't jump straight to `absol-orchestrate` — there may be a planning step first if plans are thin.

When genuinely unclear between note-taker and pipeline, ask. **Never ask whether to use scratchpad vs pipeline — if it's not explicitly scratchpad, it's pipeline.**

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

3. **Plan if asked.** This is where seed grouping, blast-radius research, and design happen, in that order:

   **a. Group.**
   - **Selected seeds all share `subsystem`** → one group, no triage.
   - **Selected seeds span multiple subsystems** → spawn the **triage subagent** (see below) for grouping (clusters are subsystem-disjoint, no cross-contamination).

   **b. Research (before the planner).** Invoke the `absol-research` skill on the grouped seeds to map the codebase blast radius and annotate each seed with `research_notes`. This is the lever against the planner's #1 failure — plans that under-predict `files_touched` because one planner context can't see the whole consumer graph. Research scales itself to the work (it skips trivial single-file seeds and fans out only on cross-cutting ones), so always offer it through; the only time to skip entirely is when *every* selected seed is a trivial one-file edit. Research writes `research_notes` in place and returns — no plan, no code.

   **c. Plan.**
   - One group → spawn one `absol-planner` with its seeds.
   - Multiple groups → spawn one `absol-planner` per group, in parallel.

   Each planner reads the seeds' `research_notes` (and `shaper_notes`, if any), appends a PLAN-NNN entry to `plan.md`, and flips its consumed seeds to `status: promoted`. **If a planner returns `verdict: human-required`** (it sees seeds that don't share a fix), see **Bad-grouping handling** below before continuing.

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

- One mode per turn; never run two at once, and don't re-invoke a mode that's already running.
- You never write to `state.md` or `.absol/` data files directly — delegate to note-taker / scratchpad / planner / orchestrate / finalizer. Sole exception: the recovery flow's Force-clear / Discard cleanup (remove transient sections, delete orphan files).
- `absol-orchestrate` is internal — invoke it only via this skill, never by name to the user.
