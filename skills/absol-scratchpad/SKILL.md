---
name: absol-scratchpad
description: Adhoc execution and ideation mode for absol projects. Use when the user wants something fixed, explored, or discussed *now* without going through the formal pipeline (planner → executor → reviewer → finalizer). Three flavours — handle a free-form task the user describes, pull a single [note] from inbox/bugs/tech-debt to work on, OR run a pure ideation session (auth flow tradeoffs, exploring how a module works, sketching design) where no code changes happen but a light discussion log gets archived. Uses the same run-active.md event model as pipeline runs (synthetic SCR-NNN ids, mode:scratchpad), so finalizer processes it identically. Invoked by the /absol entry skill when conversation looks like adhoc work or discussion, or directly when the user says "scratchpad", "fix this real quick", "just patch X", "let's discuss X", or pulls a specific bug/inbox item to handle now.
---

# absol-scratchpad

Adhoc work mode. The user has something specific in mind and doesn't want the formal pipeline overhead — no planning session, no checkpoint, no review gate. You execute, log, and move on.

This exists because the pipeline is heavy by design (it has to be, for unattended runs). When the user is sitting right there and the work is small, the heaviness is friction. Scratchpad is the relief valve.

But scratchpad still **logs everything** through `run-active.md` in the same shape as a pipeline run, so:

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
  - hitl: no                                 ← user is right here; no async pause needed
  - executor_tier: n/a                       ← scratchpad runs inline (worker: scratchpad); never spawns the executor agent
  - execution_order: 1                       ← incrementing per session
```

Then execute (next section). Append events as you go.

## Execute

Same execution rules as the executor agent — same TDD/direct-edit split:

### TDD path (FEATURE, medium-or-higher BUG)

Red → green → refactor, vertically. One behaviour at a time. **Reject horizontal TDD** (writing all tests then all code) and **implementation tests** (testing private functions, asserting on data shapes when behaviour is what matters).

### Direct-edit path (TWEAK, CHORE, low-risk BUG, exploratory)

Make the edit, run verification, record. TDD overhead isn't worth it for one-line CSS or a typo fix.

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

## When the work is bigger than scratchpad-shaped

If during execution you discover the change touches multiple subsystems, needs design discussion, or has irreversible effects, **stop and tell the user**:

> *"This is bigger than scratchpad-shaped — touches X, Y, Z. Want me to capture what we've learned as inbox notes and run the pipeline on it via `/absol`? Or push through here?"*

User picks. If they push through, continue but flag in the task's `summary`. If they want pipeline:

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
     - hitl: no
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
- Never spawn the executor or planner agents. Scratchpad work is inline by definition. Escalate to pipeline if the work is too big.
- Same `[task]` schema as pipeline tasks. The finalizer reads `worker:` and `mode:` to distinguish, not the schema shape.
- Pulled `[note]` gets `promoted_to: SCR-NNN` immediately (not at session close), so we never lose the link if the session is interrupted. **On escalation to pipeline, demote it back** (remove `promoted_to`, restore `status: new`).
- Honor the pause/active-run lock — refuse to open if either is set in state.md.
- `note-taker` is allowed mid-session for stray observations.
- Update `last_event_at` on every event append. This is what keeps `/absol`'s liveness check accurate.
- Verbose explanations belong in chat, not in `[task].description`. Description should be planner-quality concrete facts.
