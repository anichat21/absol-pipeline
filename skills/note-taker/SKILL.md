---
name: note-taker
description: Routes shower-thought notes to the right durable file in the current absol project — bug → .absol/bugs.md, tech debt → .absol/tech-debt.md, feature idea or anything ambiguous → .absol/inbox.md as status:new. Use whenever the user says things like "note that...", "add a bug...", "log a todo...", "remember this...", "add to tech debt...", or describes a bug, limitation, or feature idea they want tracked. Trigger even if the user doesn't say "note-taker" explicitly.
---

# note-taker

Route a quick note to the right durable file. Three destinations, one schema. Never writes to `state.md` (finalizer-owned).

| Destination | Goes here |
|---|---|
| `.absol/bugs.md` | Broken behaviour the user observed |
| `.absol/tech-debt.md` | Code shortcuts, messy areas, things to clean up |
| `.absol/inbox.md` (`status: new`) | Feature ideas; anything not clearly bug or debt; anything ambiguous |

**Ambiguity default: inbox.** Triage will reclassify on the next pass. Bugs and debt files don't get re-triaged, so under-classifying there silently loses signal.

## Layout fallback

If `.absol/` doesn't exist, write to root-level `bugs.md` / `tech-debt.md` / `inbox.md`. If those don't exist either (older projects with sections inside `state.md`), fall back to the matching section. Append a one-liner to your confirmation: *"Project is on legacy layout — run `/absol-migrate` to upgrade."*

## Find the project

Walk up from cwd until you hit `state.md`. Resolve `.absol/` relative to that. If neither exists within 5 levels, ask which project — don't guess.

## Schema

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

ID prefix matches destination. Counters are independent per file. Read the file, find the highest ID with that prefix, increment.

If the destination has placeholder text (`_None yet._`), replace it with the new entry. Otherwise append.

## Classify

- **bug** — "broken", "doesn't work", "crashes", an observed defect
- **tech debt** — "hacky", "shortcut", "should clean up", an internal-quality issue
- **else** — inbox

If the note is too vague to be useful, ask **one** focused follow-up. Don't run a questionnaire.

## Confirm

One line including the ID:

> Added **BUG-004** to `.absol/bugs.md` (metagross): inventory resets on reconnect due to socket ID keying.
