---
name: note-taker
description: Records bugs, tech debt, and planned features into the current project's state.md file using absol's structured schema format. Use this skill whenever the user says things like "note that...", "add a bug...", "log a todo...", "remember this...", "add to tech debt...", "write down...", "make a note...", or describes a bug, limitation, or feature idea they want tracked. Trigger even if the user doesn't say "note-taker" explicitly — if they're describing something to track in a project, this skill is the right one to use.
---

## What this skill does

Appends a structured, machine-readable note to the correct section of the current project's `state.md`. Notes use absol's compact markdown list-block format with typed fields, auto-incrementing IDs, and stable field names.

The three sections you can write to are:

- **Tech Debt** — code shortcuts, messy areas, things that need a proper fix later
- **Known Bugs** — broken behaviour the user has observed or discovered
- **Planned Features** — ideas or future functionality to build

---

## Note schema

Each note is a markdown list block following this structure:

```
- [note]
  - id: BUG-001
  - title: Short descriptive title
  - description: Clear, precise explanation of the issue or idea (1-2 sentences)
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area (e.g. auth, api, ui, db, rendering, networking)
  - status: new
```

### ID prefixes by section

| Section | Prefix | Example |
|---------|--------|---------|
| Known Bugs | BUG- | BUG-001 |
| Tech Debt | DEBT- | DEBT-001 |
| Planned Features | FEAT- | FEAT-001 |

### Type mapping

The `type` field uses absol's task classes. Choose the best fit based on the note content, not just the section it's in — a tech debt item might be ARCH (structural refactor) or CHORE (cleanup), and a planned feature might be FEATURE or TWEAK:

| Type | Use for |
|------|---------|
| ARCH | Architectural changes, refactors that alter system structure |
| FEATURE | New user-facing functionality |
| BUG | Broken behavior that needs fixing |
| TWEAK | Small improvements to existing behavior |
| CHORE | Maintenance, deps, config, docs, cleanup |

### Priority

If the user doesn't indicate urgency, use your judgment:
- **critical** — blocks work or causes data loss
- **high** — significant impact, should be addressed soon
- **medium** — matters but isn't urgent (this is the default if unclear)
- **low** — nice to have, no pressure

---

## Step 1: Find the project

Look at the current working directory. Walk up the directory tree until you find a `state.md` (case-insensitive). If you're in `/mnt/nas/dev/projects/metagross/client`, the state file is at `/mnt/nas/dev/projects/metagross/state.md`.

If you can't find a `state.md` nearby, ask the user which project they're referring to.

---

## Step 2: Understand the note

Read what the user said and decide:

1. **Which section?** Is this a bug, tech debt, or planned feature? If it's ambiguous, make a reasonable call — don't ask unless it's genuinely unclear.
2. **Is there enough detail?** If the note is too vague to be useful (e.g. "fix the login thing" with no context about what's wrong), ask one focused follow-up question to get the missing detail. Don't ask multiple questions at once.

---

## Step 3: Determine the next ID

Read the target section in `state.md` and find the highest existing ID with that section's prefix. Increment by 1. If no entries exist yet, start at 001.

For example, if the last entry in Known Bugs is `BUG-003`, the next one is `BUG-004`.

---

## Step 4: Write the note

Format the note as a structured list block following the schema above. The `title` should be a short, descriptive phrase. The `description` should capture the essential information precisely — write it the way an experienced developer would jot it down, no filler.

**Good example:**
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

**Bad example:**
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

Append the list block to the correct section in `state.md`. Find the section header (e.g. `## Known Bugs`) and add the new entry at the end of that section's existing list, before the next `---` or `##` heading.

If the section currently says something like `_All known tech debt resolved_` or is otherwise empty/placeholder text, replace that placeholder line with your new note.

---

## Step 5: Confirm

Tell the user what you wrote and where, in one short sentence. Include the ID. For example:

> Added **BUG-004** to Known Bugs in `projects/metagross/state.md`: inventory resets on reconnect due to socket ID keying.
