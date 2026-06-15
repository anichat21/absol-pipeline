---
name: note-taker
description: Routes shower-thought notes to the right durable file in the current absol project — bug → .absol/bugs.md (BUG-NNN), tech debt → .absol/tech-debt.md (DEBT-NNN), feature idea or anything ambiguous → .absol/inbox.md as INBOX-NNN status:new. One unified [note] schema across all three destinations. Use whenever the user says things like "note that...", "add a bug...", "log a todo...", "remember this...", "add to tech debt...", or describes a bug, limitation, or feature idea they want tracked. Trigger even if the user doesn't say "note-taker" explicitly — it's the only way intake gets classified before the planner sees it.
---

# note-taker

Route a quick note to the right durable file. Three destinations, one schema. You are the only intake classifier in the absol pipeline — the planner trusts your routing and never re-classifies, so a note that lands in the wrong file silently loses signal.

| Destination | Goes here | ID prefix |
|---|---|---|
| `.absol/bugs.md` | Broken behaviour the user observed | BUG- |
| `.absol/tech-debt.md` | Code shortcuts, messy areas, things to clean up | DEBT- |
| `.absol/inbox.md` | Feature ideas; anything not clearly bug or debt; anything ambiguous | INBOX- |

**Ambiguity default: inbox.** Bugs and debt files don't get re-triaged — under-classifying there silently loses signal. Over-classifying as a feature is recoverable; the planner sees inbox items every run.

## Find the project

Walk up from cwd until you hit `state.md`. Resolve `.absol/` relative to that. If neither exists within 5 levels, ask which project — don't guess.

## Layout fallback

If `.absol/` doesn't exist, write to root-level `bugs.md` / `tech-debt.md` / `inbox.md`. If those don't exist either (older projects with sections inside `state.md`), fall back to the matching section. Append a one-liner to your confirmation: *"Project is on legacy layout — run `/absol-migrate` to upgrade."*

## Schema

One unified `[note]` shape across all three files. ID prefix is the only difference.

```
- [note]
  - id: BUG-001 | DEBT-001 | INBOX-001
  - title: short descriptive title
  - description: 1–2 sentence precise explanation
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low      (default: medium)
  - subsystem: affected area
  - status: new
```

Counters are independent per file. Read the file, find the highest ID with that prefix, increment.

If the destination has placeholder text (`No items yet.`, `_None yet._`), replace it with the new entry. Otherwise append.

## Classify

- **bug** — *"broken"*, *"doesn't work"*, *"crashes"*, an observed defect → `bugs.md`
- **tech debt** — *"hacky"*, *"shortcut"*, *"should clean up"*, an internal-quality issue → `tech-debt.md`
- **else** — `inbox.md`

If the note is too vague to be useful (no clear behaviour, no subsystem, no specific complaint), ask **one** focused follow-up. Don't run a questionnaire — that's `/absol-shaper`'s job.

## Capture context generously

The note is the planner's only window into the moment the idea was had. Lift relevant context from the surrounding chat into `description` so the planner doesn't have to guess what triggered the thought. *"Crash on logout when user has 0 contacts (came up while testing the contacts panel refactor)"* is far more useful than *"crash on logout."*

## Confirm

One line including the ID:

> Added **BUG-004** to `.absol/bugs.md` (metagross): inventory resets on reconnect due to socket ID keying.

## Rules

- Three destinations, one schema — never invent a fourth. Your only writes are `[note]` entries in `bugs.md` / `tech-debt.md` / `inbox.md`; never `state.md` (finalizer-owned) or `plan.md` (planner-owned).
- Each note stands alone — don't pull existing items in; cross-referencing is the planner's job.
