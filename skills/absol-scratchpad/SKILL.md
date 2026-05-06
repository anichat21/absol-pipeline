---
name: absol-scratchpad
description: Adhoc execution mode for absol projects. Use when the user wants something fixed or explored *now* without going through the formal pipeline (planner → executor → reviewer → finalizer). Can pull a single [note] from inbox/bugs/tech-debt to work on, or take a free-form task the user describes. Logs each piece of work as a [task] entry in .absol/todo-run.md with worker:scratchpad and synthetic SCR-NNN ids — same archive shape as a pipeline run, so finalizer processes it identically. Invoked by the /absol entry skill when conversation looks like adhoc work, or directly when the user says "scratchpad", "fix this real quick", "just patch X", or pulls a specific bug/inbox item to handle now.
---

# absol-scratchpad

Adhoc work mode. The user has something specific in mind and doesn't want the formal pipeline overhead — no planning session, no checkpoint, no review gate. You execute, log, and move on.

This exists because the pipeline is heavy by design (it has to be, for unattended runs). When the user is sitting right there and the work is small, the heaviness is friction. Scratchpad is the relief valve.

But scratchpad still **logs everything** to `todo-run.md` in the same shape as a pipeline run, so:

- `state.md` reflects what changed
- The session is archived after close
- Pulled `[note]`s are properly resolved (not orphaned)
- The finalizer's job is identical — it doesn't need to know whether the run came from pipeline or scratchpad

## When you're invoked

Three entry paths:

1. **`/absol` routes you** when conversation looks adhoc. Project context already established.
2. **User directly asks for scratchpad** — e.g. *"open scratchpad on snowowl"*. Establish project the same way `/absol` does (look in `/mnt/nas/dev/projects/<name>/`).
3. **User pulls a specific note** — *"fix BUG-017 real quick"*. The note ID is your starting task; pull and execute.

If the project has a `## Pause` section in `state.md`, **stop**. Tell the user the project is locked by a paused pipeline and they need to Resume / Finalize-away via `/absol` first. (The `/absol` entry skill normally enforces this; this is a defense-in-depth check in case scratchpad is invoked directly.)

## Open the session

Generate a session id. Format: `SCR-{YYYY-MM-DD}` (or `-2`, `-3` for same-day reruns — check `todo-run.md` for collisions).

Don't write anything to `todo-run.md` yet. The first `[task]` entry establishes the session.

If you're working on the user's free-form description, restate what you're about to do in one sentence. *"Scratchpad on snowowl — fixing the typo in src/header.tsx."* This gives the user a chance to redirect before any edits land.

## Pull a note (if applicable)

If the user named a `[note]` (e.g. *"pull BUG-017"*):

1. Read the note from `.absol/bugs.md` / `.absol/tech-debt.md` / `.absol/inbox.md`.
2. Use its `description`, `subsystem`, and `shaper_notes` (if present) as the task brief.
3. Mark the source note `status: promoted` and add `promoted_to: SCR-001` (the SCR id you're about to create).

If the work spawns multiple tasks within one scratchpad session, only the first task carries the `promoted_to` link. Subsequent tasks are unrelated work the user is folding in.

## Execute

Same execution rules as the executor agent:

### TDD path (FEAT, medium-or-higher BUG)

Red → green → refactor, vertically. One behaviour at a time. **Reject horizontal TDD** (writing all tests then all code) and **implementation tests** (testing private functions, asserting on data shapes when behaviour is what matters).

### Direct-edit path (TWEAK, CHORE, low-risk BUG, exploratory)

Make the edit, run verification, record. TDD overhead isn't worth it for one-line CSS or a typo fix.

### When you should escalate to the pipeline

If during scratchpad work you discover the change is bigger than expected — touches multiple subsystems, needs design discussion, has irreversible effects — **stop and tell the user**:

> *"This is bigger than scratchpad-shaped — touches X, Y, Z. Want me to capture what we've learned as an inbox note and run the pipeline on it via `/absol`? Or push through here?"*

User picks. If they push through, continue but flag in the `[task].notes`. If they want pipeline, capture the constraints, leave a note via `note-taker`, close the scratchpad session.

## Log each piece of work

Append a `[task]` entry to `.absol/todo-run.md` for every discrete unit of work. Use the unified schema from `references/schemas.md`:

```
- [task]
  - id: SCR-001                              ← scratchpad counter, separate from TSK-
  - plan_id: SCRATCHPAD                      ← sentinel; no plan.md entry exists
  - run_id: SCR-2026-05-06
  - type: BUG | TWEAK | CHORE | FEATURE
  - title: action-oriented short title
  - description: what was done (concrete; reference files/functions by name)
  - subsystem: affected area
  - dependencies: none                       ← scratchpad work is sequential by definition
  - acceptance_criteria: how the user will know this worked
  - verification: command run (or "user-eyes" if visual change)
  - risk: low | medium | high
  - hitl: no                                 ← user is right here; no async pause needed
  - executor_tier: inline                    ← scratchpad never spawns the executor agent
  - execution_order: 1                       ← incrementing per session
  - status: in-progress
```

When the work completes, fill in run-time fields:

```
  - status: done | failed | blocked
  - worker: scratchpad
  - files_touched_actual: src/foo.ts, src/bar.ts
  - summary: one line — what was actually done
  - verification_result: pass | fail | skipped
  - blocker: description (or: none)
  - review_flag: yes | no                    ← yes if you're uncertain or touched a shared interface
```

## Capture stray notes mid-session

If during scratchpad work the user mentions a separate idea or you spot another bug, **invoke `note-taker`** to capture it cleanly. Don't try to handle it in the same session — that's how scratchpad turns into accidental pipeline work.

## Close the session

The user signals close: *"that's it"*, *"done for now"*, *"thanks, close it"*, or simply moves on to a different topic.

When closing:

1. Make sure every `[task]` in this session has its run-time fields filled in (status, worker, files_touched_actual, summary, verification_result).
2. **Invoke `absol-finalizer`** with the scratchpad run_id. The finalizer:
   - Archives `todo-run.md` to `archive/run-{SCR-YYYY-MM-DD}.md`
   - Updates `state.md` Last Session
   - Removes any `[note]`s that were `promoted_to: SCR-NNN` (since they're resolved)
   - Compacts older sessions if needed

3. Report close in one line:

   > Scratchpad SCR-2026-05-06 closed: 3 tasks (BUG-017 fixed, 2 tweaks). state.md updated, run archived.

## When to *not* close

If a `[task]` failed or got blocked and the user hasn't decided what to do, don't close. Leave the session open with the unresolved task in `todo-run.md` and ask the user. *"TSK SCR-002 blocked by missing dep. Install and retry, skip, or close session with this marked as blocked?"*

## Rules

- One scratchpad session at a time per project. If `todo-run.md` already has open `worker: scratchpad` entries, resume that session instead of starting a new one.
- Never spawn the executor or planner agents. Scratchpad work is inline by definition. Escalate to pipeline if the work is too big.
- Same `[task]` schema as pipeline tasks. The finalizer reads `worker:` to distinguish, not the schema shape.
- Pulled `[note]` gets `promoted_to: SCR-NNN` immediately (not at session close), so we never lose the link if the session is interrupted.
- Honor the pause lock — refuse to open if `state.md` has a `## Pause` section.
- `note-taker` is allowed mid-session for stray observations. Don't try to solve everything in one scratchpad.
- Verbose explanations belong in chat, not in `[task].description`. Description should be the planner-quality concrete facts.
