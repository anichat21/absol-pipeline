---
name: absol
description: Front door for absol project sessions. Opens the project, recovers crashed/paused runs, prints a derived status banner, then routes conversation to note-taker (capture), scratchpad (interactive), or a pipeline run (default for action requests, incl. scheduled/AFK). Use on '/absol', '/absol <project>', or 'work on <project>'.
---

# absol

Data shapes: `references/schemas.md`; conduct: `references/doctrine.md` (both relative to this
skill — doctrine governs rules-vs-facts, git flow, and effort allocation everywhere). Three
jobs: open the project, recover if needed, route the conversation.

## Entry

Resolve `/mnt/nas/dev/projects/<project>/`; if no exact match, list `projects/` and ask. cd in;
paths below are project-relative. No `.absol/` folder → tell the user to run `/absol-migrate`
(legacy layout) or `/absol-newproject`, and stop.

> **TEMPORARY — delete this block once every project is migrated to v2.** `.absol/plan.md`
> exists, or the ledger files contain `[note]` entries → the project is still on the v1
> schema; v2 banner greps and fold-backs silently mis-read v1 files. Tell the user to run
> `/absol-migrate` first, and stop.

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
⚠ Open:        BUG-014 — <the question AFK shaping logged>     (omit if none)
⚠ Smell:       INBOX-021 — <why attempts kept failing>         (omit if none)
Primed:       N — BUG-014 (+2 covered), INBOX-030   (items with a plan block)
Shaped:       N    New: N    (per file: inbox / bugs / debt, non-zero counts only)
Smoke: N owed · Tuning: N · Parked: N     (counts only, non-zero; "smoke"/"tuning"/"parked" lists them)
```

Count definitions (mechanical): **Primed** = has a `plan:` block (or a lead's `covers:` names
it). **Shaped** = has `shape:` but no plan. **New** = has neither `shape:` nor `plan:`.
A `map:` block affects no count. `tags: tuning`, `tags: parked`, and VERIFY items live outside
all counts above — quiet lanes, one count line, enumerated only when the user asks. Parked items
never enter type-wide run selections ("run the inbox") — only an explicit ID runs one.

`open:` lines are answerable right here — the user's answer gets transcribed into the item's
shape (via note-taker) and the `open:` line deleted; the item is then runnable.

Six-to-ten lines, no file dumps. **Smoke ledger:** a reference checklist, not an alarm —
silence is a pass signal (doctrine). When the user confirms a VERIFY item passed, delete it;
if it failed, route to note-taker as a BUG, then delete it. Decay is the finalizer's job.

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
3. **Planner tier** (attended only): planners default to Opus. When the selection is a genuine
   system rework — cross-cutting ARCH scope, many subsystems — propose the upgrade in one line
   with the reason ("this touches all 9 routers — Fable planner? y/n") and pass the answer as
   `planner_model:`. AFK runs stay on the default.
4. Invoke `absol-orchestrate` with `items:` + `afk:` (+ `planner_model:` if upgraded). It
   gates, plans what's missing, executes, reviews, and finalizes — including the checkpoint
   UX, so don't pre-ask anything else.

**Scheduling** ("run this tonight", "every morning"): use the `schedule` skill to create a
headless invocation of `/absol <project> run <selection> afk`. The gate makes this safe:
un-shaped ambiguous items are skipped and reported, never guessed at.

**Planner human-required** (grouped items don't share a fix): show the suggested regrouping,
ask **Accept** / **All singletons** / **Cancel**; re-invoke accordingly.

## Rules

- Your only direct ledger write is deleting confirmed VERIFY items. Everything else is
  delegated (note-taker / shaper / research / planner / orchestrate / finalizer).
- `absol-orchestrate` is internal — never suggest it to the user by name.
- Question contract everywhere: ask only when the answer changes what happens next and ≥2
  options are genuinely defensible; recommendation first; two real options beat three padded.
