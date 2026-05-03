---
name: note-taker
description: Routes shower-thought notes to the right durable file in the current absol project — bug → .absol/bugs.md, tech debt → .absol/tech-debt.md, feature idea or anything ambiguous → .absol/inbox.md as status:new. Use this skill whenever the user says things like "note that...", "add a bug...", "log a todo...", "remember this...", "add to tech debt...", "write down...", "make a note...", or describes a bug, limitation, or feature idea they want tracked. Trigger even if the user doesn't say "note-taker" explicitly — if they're describing something to track in a project, this skill is the right one to use.
---

## What this skill does

Routes a quick note from the user into the correct durable file in the project's `.absol/` folder. Three destinations, one schema.

| Destination | What goes there |
|---|---|
| `.absol/bugs.md` | Broken behaviour the user has observed or discovered |
| `.absol/tech-debt.md` | Code shortcuts, messy areas, things that need a proper fix later |
| `.absol/inbox.md` (`status: new`) | Feature ideas, anything not clearly a bug or debt, anything ambiguous |

`state.md` is **not** a destination. The finalizer owns `state.md`; it's a truth snapshot, not a notes file.

## Layout fallback

If the project is on the legacy flat layout (no `.absol/`, files at root), write to root-level `bugs.md` / `tech-debt.md` / `inbox.md` instead. If those don't exist on the legacy layout (older projects had Tech Debt and Known Bugs *inside* `state.md`), fall back to the matching section in root-level `state.md`. Then surface a one-line recommendation in your confirmation: *"This project is on the legacy layout — run `/absol-migrate` to upgrade."*

## Note schema

Every note is a markdown list block with stable field names:

```
- [note]
  - id: BUG-001
  - title: short descriptive title
  - description: clear, precise explanation (1–2 sentences)
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area (e.g. auth, api, ui, db, rendering, networking)
  - status: new
```

### ID prefixes by destination

| File | Prefix | Example |
|---|---|---|
| `.absol/bugs.md` | `BUG-` | BUG-001 |
| `.absol/tech-debt.md` | `DEBT-` | DEBT-001 |
| `.absol/inbox.md` | `INBOX-` | INBOX-001 |

### Type mapping

The `type` field uses absol's task classes. Choose by note content, not by destination — a tech-debt entry might be `ARCH` (structural refactor) or `CHORE` (cleanup), and an inbox feature idea might be `FEATURE` or `TWEAK`:

| Type | Use for |
|---|---|
| ARCH | Architectural changes, refactors that alter system structure |
| FEATURE | New user-facing functionality |
| BUG | Broken behaviour that needs fixing |
| TWEAK | Small improvements to existing behaviour |
| CHORE | Maintenance, deps, config, docs, cleanup |

### Priority

If urgency isn't stated, use judgement:

- **critical** — blocks work or causes data loss
- **high** — significant impact, address soon
- **medium** — matters but isn't urgent (default if unclear)
- **low** — nice to have

---

## Step 1 — Find the project

Walk up from the current working directory until you find a `state.md` (case-insensitive). That folder is the project root. Resolve `.absol/` relative to it. If neither `state.md` nor `.absol/` is found within 5 levels up, ask the user which project they mean — don't guess.

## Step 2 — Classify the note

Read what the user said and decide which file to route to:

1. **Bug** → `.absol/bugs.md`. Signals: "broken", "doesn't work", "crashes", "wrong output", "the X feature is failing", an observed reproducible defect.
2. **Tech debt** → `.absol/tech-debt.md`. Signals: "hacky", "shortcut", "should clean up", "duplication", "this needs a refactor", an internal-quality issue with no user-visible bug.
3. **Anything else** → `.absol/inbox.md` with `status: new`. Feature ideas, "we should also build X", future-direction thoughts, or anything that doesn't cleanly fit bug/debt.

**Ambiguity default: `.absol/inbox.md`.** When the note could plausibly be a feature OR a tech-debt item, prefer inbox. The next triage / planner pass will reclassify if needed. Bugs and debt files don't get re-triaged, so under-classifying there silently loses signal.

If the note is too vague to be useful (e.g. "fix the login thing" with no context), ask **one** focused follow-up — not a questionnaire. Then re-classify.

## Step 3 — Determine the next ID

Read the destination file. Find the highest existing ID with that file's prefix. Increment by 1. If no entries exist, start at 001.

The three counters are independent: `bugs.md` has its own `BUG-NNN` sequence, `tech-debt.md` has `DEBT-NNN`, `inbox.md` has `INBOX-NNN`.

## Step 4 — Write the note

Append the structured `[note]` block to the destination file. The `title` is short and descriptive. The `description` captures the essential information precisely — write it the way an experienced developer would jot it down, no filler.

**Good:**

```
- [note]
  - id: BUG-003
  - title: Inventory reset on reconnect
  - description: Player inventory is wiped when they disconnect and rejoin because the server keys it to socket ID rather than a stable player identity.
  - type: BUG
  - priority: high
  - subsystem: networking
  - status: new
```

**Bad:**

```
- [note]
  - id: BUG-003
  - title: Inventory issue
  - description: The user said there might be an issue where inventory goes away sometimes.
  - type: BUG
  - priority: medium
  - subsystem: unknown
  - status: new
```

If the destination file currently has placeholder text (e.g. `_No known bugs._` or `_None yet._`), replace the placeholder with the new entry. Otherwise append at the end of the entries list.

## Step 5 — Confirm

Tell the user what you wrote, where, in one short sentence including the ID:

> Added **BUG-004** to `.absol/bugs.md` (metagross): inventory resets on reconnect due to socket ID keying.

Or, for an inbox routing:

> Added **INBOX-012** to `.absol/inbox.md` (metagross) as a new feature idea: per-room sound profiles. The next orchestrate run will triage it.

If you fell back to the legacy layout, append the migrate suggestion on a new line.

## Rules

- **Never write to `state.md`.** State is finalizer territory.
- **Three destinations, no fourth.** If you're tempted to invent a new file, route to inbox instead and let triage decide.
- **Default to inbox on ambiguity.** Recoverable bias.
- **One follow-up question max.** Don't interrogate the user for a quick note.
- **Don't reformat existing entries.** Append only.
