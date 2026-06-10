---
name: absol-scratchpad
description: Interactive freestyle mode for absol projects — you and the user building, fixing, exploring, or discussing live, with absol's documentation tracking underneath. Use when the user wants to work directly with you *now* instead of through the formal unattended pipeline (planner → executor → reviewer → finalizer). The boundary is interactivity, not size — a whole feature is fine here if the user wants to drive it live (including dispatching a dynamic workflow for the heavy lifting); escalate to pipeline only when the work wants the pipeline's properties (unattended, front-loaded decisions, a durable plan). Flavours — handle a free-form task, pull a single [note] from inbox/bugs/tech-debt to build interactively, OR run a pure ideation session where no code changes happen but a light discussion log gets archived. Uses the same run-active.md event model as pipeline runs (synthetic SCR-NNN ids, mode:scratchpad), so finalizer processes it identically. Invoked by the /absol entry skill when conversation looks like interactive work or discussion, or directly when the user says "scratchpad", "fix this real quick", "just patch X", "let's build X here", "let's discuss X", or pulls a specific bug/inbox item to handle now.
---

# absol-scratchpad

Interactive freestyle mode. You and the user work directly — build, fix, explore, discuss — with absol's documentation tracking running underneath. No planning session, no checkpoint, no review gate; decisions get made live, as you go.

This exists because the pipeline is heavy *by design* — it front-loads every decision into shaping so it can then run unattended. When the user is sitting right there, that heaviness is friction: they can just tell you the next call instead of locking it into `shaper_notes` first. **Scratchpad is where the human stays in the loop.**

The boundary between scratchpad and pipeline is **interactivity, not size.** A whole feature is fair game here if the user wants to drive it live — and for the heavy lifting you can dispatch a dynamic workflow (see below), which is *safe in scratchpad precisely because the user is present*: a background workflow can't stop to ask questions, but here the human is already in the chat to answer them. You escalate to the pipeline only when the work wants the pipeline's *properties* — unattended execution, front-loaded decisions, a durable archived plan — not merely because it's large.

Scratchpad **logs everything** through `run-active.md` in the same shape as a pipeline run, so:

- `state.md` reflects what changed
- The session is archived after close (one `archive/run-{SCR-id}.md` file)
- Pulled `[note]`s are properly resolved (not orphaned)
- The finalizer's job is identical — it doesn't need to know whether the run came from pipeline or scratchpad

## When you're invoked

Three entry paths:

1. **`/absol` routes you** when conversation looks adhoc. Project context already established.
2. **User directly asks for scratchpad** — e.g. *"open scratchpad on snowowl"*. Establish project the same way `/absol` does (look in `/mnt/nas/dev/projects/<name>/`).
3. **User pulls a specific note** — *"fix BUG-017 real quick"*. The note ID is your starting task; pull and execute.

## Recovery / lock checks (before opening)

Same checks `/absol` runs at entry — if scratchpad is invoked directly, defense-in-depth applies:

- `state.md` has `## Pause` → project is locked by a paused pipeline. Stop. Tell the user to Resume / Finalize-away via `/absol`.
- `state.md` has `## Active Run` (without Pause) and `run-active.md` exists → another session is open or crashed. Stop. Tell the user `/absol` will handle recovery.
- Any state drift → Stop. Tell the user.

## Open the session

1. Generate `run_id`: `SCR-{YYYY-MM-DD}` (or `-2`, `-3` for same-day reruns — check `archive/` for collisions).
2. Write `## Active Run` to `state.md` (`mode: scratchpad`, `started_at`, `last_event_at` = now).
3. Create `run-active.md` with the header. Leave Tasks snapshot empty for now (scratchpad fills it incrementally as work emerges).

If you're working on the user's free-form description, restate what you're about to do in one sentence. *"Scratchpad on snowowl — fixing the typo in src/header.tsx."* This gives the user a chance to redirect before any edits land.

## Pull a note (if applicable)

If the user named a `[note]` (e.g. *"pull BUG-017"*):

1. Read the note from `.absol/bugs.md` / `.absol/tech-debt.md` / `.absol/inbox.md`.
2. Use its `description`, `subsystem`, and `shaper_notes` (if present) as the task brief.
3. Mark the source note `status: promoted` and add `promoted_to: SCR-001` (the SCR id you're about to create).

If the work spawns multiple SCR tasks within one session, only the first task carries the `promoted_to` link. Subsequent tasks are unrelated work the user is folding in.

## Add a [task] entry to the snapshot

Before executing each piece of work, append a new `[task]` block to the `## Tasks (snapshot)` section of run-active.md:

```
- [task]
  - id: SCR-001                              ← scratchpad counter, separate from TSK-
  - plan_id: SCRATCHPAD                      ← sentinel
  - run_id: SCR-2026-05-06
  - type: BUG | TWEAK | CHORE | FEATURE
  - title: action-oriented short title
  - description: what to do (concrete, references files/functions by name)
  - subsystem: affected area
  - files_touched: <best-effort prediction>
  - dependencies: none                       ← scratchpad work is sequential by definition
  - acceptance_criteria: how the user will know this worked
  - verification: command run (or "user-eyes" if visual change)
  - risk: low | medium | high
  - executor_tier: n/a                       ← worker: scratchpad; never spawns the pipeline executor agent (a dispatched workflow is fine)
  - execution_order: 1                       ← incrementing per session
```

Then execute (next section). Append events as you go.

## Execute

Same execution rules as the executor agent for direct work — the TDD/direct-edit split below — plus a workflow path for large interactive builds:

### TDD path (FEATURE, medium-or-higher BUG)

Red → green → refactor, vertically. One behaviour at a time. **Reject horizontal TDD** (writing all tests then all code) and **implementation tests** (testing private functions, asserting on data shapes when behaviour is what matters).

### Direct-edit path (TWEAK, CHORE, low-risk BUG, exploratory)

Make the edit, run verification, record. TDD overhead isn't worth it for one-line CSS or a typo fix.

### Dynamic workflow path (large interactive builds)

When the user wants to build something big *here* rather than route it through the pipeline — a whole feature, a multi-file change, a parallel research-then-build — dispatch a **dynamic workflow** (the Workflow tool — this skill's instructions are your opt-in) to do the heavy lifting while you stay in the conversation. This is the scratchpad-native way to take on pipeline-sized work without the pipeline's unattended contract: the workflow runs the fan-out, and *you* are still here to answer the design questions a background workflow can't ask.

Use it only when the build genuinely benefits — multiple files, work that parallelises, or a research+build sweep. For anything a couple of edits can do, stay on the TDD/direct-edit paths; firing a fleet at small work is waste.

Before dispatching: tell the user in one line what the workflow will do (roughly how many agents, what it'll touch), so they can redirect first — same courtesy as restating a free-form task. Then:

1. Append the `[task]` entry(ies) to the snapshot as usual (one per coherent slice of the build).
2. Dispatch the workflow. Code-writing workflow agents that touch the same files in parallel need `isolation: 'worktree'`; a sequential build or a read-only research sweep doesn't.
3. When it returns, record the outcome as `task-completed` events — `files_touched_actual` is the union the workflow reports, and the `summary` notes it was built via workflow (e.g. *"built via dynamic workflow, 6 agents"*). `worker:` stays `scratchpad` — you orchestrated it.

Everything downstream (finalizer, archive, note resolution) is unchanged: a workflow-built feature is just a scratchpad task with a bigger blast radius.

## Append events

Every piece of work generates two `[event]` blocks in run-active.md `## Events`:

```
- [event] {ISO timestamp}
  - type: task-started
  - task_id: SCR-001
  - worker: scratchpad

- [event] {ISO timestamp}
  - type: task-completed | task-failed | task-blocked
  - task_id: SCR-001
  - status: done | failed | blocked
  - files_touched_actual: <comma-separated>
  - summary: one line
  - verification_result: pass | fail | skipped
  - review_flag: yes | no                    ← yes if uncertain or touched a shared interface
  - blocker: <if failed/blocked>
```

Update `last_event_at` in run-active.md header AND state.md `## Active Run` after every event append.

## Capture stray notes mid-session

If during scratchpad work the user mentions a separate idea or you spot another bug, **invoke `note-taker`** to capture it cleanly. Don't try to handle it in the same session — that's how scratchpad turns into accidental pipeline work.

## When the work wants the pipeline

Size is **not** the trigger — a big build can live here (dispatch a workflow). Escalate when the work wants the pipeline's *properties*, which scratchpad deliberately doesn't provide:

- **Unattended** — the user wants to walk away while it runs (scratchpad needs them present).
- **Front-loaded decisions** — there's a cluster of consequential, interdependent calls (schema/migration, public API, breaking changes) better settled up front in a shaper session than improvised live.
- **A durable plan** — the work deserves a tracked `PLAN-NNN` and a review gate, not a one-session SCR record.

When you hit one of those, **stop and tell the user**:

> *"This wants the pipeline — it needs {unattended execution / decisions pinned up front / a tracked plan}. Want me to capture what we've learned as inbox notes and run it via `/absol`? Or keep driving it here?"*

User picks. If they keep driving here, continue but flag the reason in the task's `summary`. If they want pipeline:

1. Capture context — invoke `note-taker` to log what was learned (one or more new notes).
2. **Demote any pulled source [note] back to `status: new`** (drop `promoted_to`). The work isn't done; the note shouldn't be flagged-as-resolved-but-isn't. Also append a `prior_work:` field to the note recording the partial-work archive path:
   ```
   - prior_work: SCR-2026-05-06 (partial — see archive/run-SCR-2026-05-06.md)
   ```
   The next planner sees this and reads the archive for context — knows what was tried, what worked, what didn't.
3. If any tasks completed already, leave their events as-is (they're real work; archive should preserve them).
4. Close the session via finalizer (Step "Close" below). Finalizer archives the partial run.
5. Tell the user the session closed and to invoke `/absol` for the planner→pipeline path.

## Close the session

The user signals close: *"that's it"*, *"done for now"*, *"thanks, close it"*, or moves on to a different topic.

When closing:

1. **Ideation-only check.** If no `[task]` entries got created during the session (the conversation was pure discussion — exploring how something works, considering tradeoffs, sketching design without committing), use `AskUserQuestion`:
   - question: `No edits this session — log it as a discussion?`
   - header: `Discussion log`
   - options:
     - **Log discussion** — append one DISCUSS task with a 1–3 sentence summary of what was talked about; finalize.
     - **Discard** — close without archiving. Demote any pulled `[note]` back to `status: new` (drop `promoted_to`) so it isn't stuck flagged-as-resolved-but-isn't. Then clear `## Active Run` from state.md and delete run-active.md. No archive file is written.

   On **Log discussion**, append a `[task]` to the snapshot:

   ```
   - [task]
     - id: SCR-001
     - plan_id: SCRATCHPAD
     - run_id: SCR-2026-05-06
     - type: DISCUSS
     - title: <one-line topic, e.g. "Auth flow tradeoffs">
     - description: <1–3 sentence summary of what was discussed>
     - subsystem: <area, or "n/a" if cross-cutting>
     - files_touched: none
     - dependencies: none
     - acceptance_criteria: n/a — discussion only
     - verification: n/a
     - risk: low
     - executor_tier: n/a
     - execution_order: 1
   ```

   Then append `task-started` and `task-completed` events with `worker: scratchpad`, `files_touched_actual: none`, `verification_result: skipped`, `summary` matching the description.

2. Make sure every other `[task]` in this session has its terminal event (`task-completed` / `task-failed` / `task-blocked`).

3. **Invoke `absol-finalizer`** with the scratchpad run_id. The finalizer:
   - Reconciles events into the archive
   - Writes `archive/run-{SCR-id}.md`
   - Deletes run-active.md
   - Clears `## Active Run` from state.md
   - Updates state.md Last Session
   - Removes any `[note]`s that were `promoted_to: SCR-NNN` (since they're resolved)
3. Report close in one line:

   > Scratchpad SCR-2026-05-06 closed: 3 tasks (BUG-017 fixed, 2 tweaks). state.md updated, run archived.

## When to *not* close

If a `[task]` failed or got blocked and the user hasn't decided what to do, don't close. Leave the session open with the unresolved task in run-active.md and ask the user. *"SCR-002 blocked by missing dep. Install and retry, skip with the block recorded, or close session anyway?"*

## Rules

- One scratchpad session at a time per project. If `state.md` has `## Active Run` for a scratchpad already, resume that session instead of starting a new one.
- Ideation sessions are first-class — a scratchpad with zero edits is a valid run. Log it as a single DISCUSS task at close (or discard if the user says it was idle chat). Don't force a fake CHORE/TWEAK shape.
- Append-only on run-active.md events (same contract as pipeline executor). You DO write to the snapshot section because you incrementally add tasks as work emerges — but each task entry is write-once: don't mutate after writing.
- Never spawn the **pipeline's** executor or planner agents — they belong to the unattended pipeline and operate on `plan.md` tasks. You MAY dispatch a dynamic workflow for a large interactive build (see the workflow path) — that's a scratchpad tool, used while the user is present. Escalate to pipeline when the work wants the pipeline's *properties*, not when it's merely big.
- Same `[task]` schema as pipeline tasks. The finalizer reads `worker:` and `mode:` to distinguish, not the schema shape.
- Pulled `[note]` gets `promoted_to: SCR-NNN` immediately (not at session close), so we never lose the link if the session is interrupted. **On escalation to pipeline, demote it back** (remove `promoted_to`, restore `status: new`).
- Honor the pause/active-run lock — refuse to open if either is set in state.md.
- `note-taker` is allowed mid-session for stray observations.
- Update `last_event_at` on every event append. This is what keeps `/absol`'s liveness check accurate.
- Verbose explanations belong in chat, not in `[task].description`. Description should be planner-quality concrete facts.
