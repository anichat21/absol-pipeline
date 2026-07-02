---
name: absol
description: Front door for absol project sessions. Opens the project, recovers crashed/paused runs, prints a derived status banner, then routes conversation to note-taker (capture), scratchpad (interactive), or a pipeline run (default for action requests, incl. scheduled/AFK). Use on '/absol', '/absol <project>', or 'work on <project>'.
---

# absol

Data shapes: `references/schemas.md` (relative to this skill). Three jobs: open the project,
recover if needed, route the conversation.

## Entry

Resolve `/mnt/nas/dev/projects/<project>/`; if no exact match, list `projects/` and ask. cd in;
paths below are project-relative. No `.absol/` folder → tell the user to run `/absol-migrate`
(legacy layout) or `/absol-newproject`, and stop.

## Recovery (before the banner)

Liveness lives entirely in `.absol/run.md`:

| State | Detection | Handling |
|---|---|---|
| Clean | no run.md | proceed |
| Live | run.md, mtime < 15 min | refuse a second session — point at the live one |
| Paused | run.md, last event `pause` | ask: **Resume** (re-enter orchestrate at `next_task`) / **Finalize away** (spawn `absol-finalizer`) |
| Crashed | run.md, mtime ≥ 15 min, last event not `pause` | spawn `absol-finalizer` with `crashed: yes`; one-line banner notice |

That's the whole matrix — the ledger is never touched mid-run, so nothing else can drift.

## Banner (derived — nothing here is stored)

Grep the three intake files and read `state.md`:

```
absol — <project>

Last session: <state.md one-liner>
⚠ Owed smoke:  VERIFY-003 — eyeball <what>          (omit if none)
Primed:       N — BUG-014 (+2 covered), INBOX-030   (items with a plan block)
Shaped:       N    New: N    (per file: inbox / bugs / debt, non-zero counts only)
```

Six-to-ten lines, no file dumps. **Owed smoke:** when the user confirms a VERIFY item passed,
delete it; if it failed, route to note-taker as a BUG, then delete it. Don't let the list rot.

## Routing

- **note-taker** — user is capturing, not asking you to act ("note that…", "idea:", "we should…").
  Also for enriching: a decisive statement about an existing item ("for BUG-014, skip the
  animation") gets transcribed into that item's `shape:` (dated) — invoke note-taker's enrich
  mode.
- **scratchpad** — only on an explicit signal: "scratchpad", "quick fix", "real quick", "let's
  build/discuss X here". Never ask scratchpad-vs-pipeline; without the signal it's pipeline.
- **run (pipeline)** — the default for any action request: "run the bugs", "do BUG-014 and
  INBOX-021", "run everything primed", "churn the inbox".

One mode per turn. Genuinely unclear between capture and action → ask.

## Launching a run

1. Resolve the selection to item IDs (named IDs, a type — "the bugs", or "everything primed").
2. Ask AFK or attended if not obvious (user present and engaged → attended; "run it and I'll
   check later", scheduled, or "afk" → `afk: yes`).
3. Invoke `absol-orchestrate` with `items:` + `afk:`. It gates, plans what's missing, executes,
   reviews, and finalizes — including the checkpoint UX, so don't pre-ask anything else.

**Scheduling** ("run this tonight", "every morning"): use the `schedule` skill to create a
headless invocation of `/absol <project> run <selection> afk`. The gate makes this safe:
un-shaped ambiguous items are skipped and reported, never guessed at.

**Planner human-required** (grouped items don't share a fix): show the suggested regrouping,
ask **Accept** / **All singletons** / **Cancel**; re-invoke accordingly.

## Rules

- Your only ledger writes: deleting confirmed VERIFY items, and shape transcription via
  note-taker. Everything else is delegated (note-taker / shaper / research / planner /
  orchestrate / finalizer).
- `absol-orchestrate` is internal — never suggest it to the user by name.
- Question contract everywhere: ask only when the answer changes what happens next and ≥2
  options are genuinely defensible; recommendation first; two real options beat three padded.
