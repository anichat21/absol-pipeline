---
name: note-taker
description: Records bugs, tech debt, and planned features into the current project's state.md file. Use this skill whenever the user says things like "note that...", "add a bug...", "log a todo...", "remember this...", "add to tech debt...", "write down...", "make a note...", or describes a bug, limitation, or feature idea they want tracked. Trigger even if the user doesn't say "note-taker" explicitly — if they're describing something to track in a project, this skill is the right one to use.
---

## What this skill does

Appends a brief, well-phrased note to the correct section of the current project's `state.md`. The three sections you can write to are:

- **Tech Debt** — code shortcuts, messy areas, things that need a proper fix later
- **Known Bugs** — broken behaviour the user has observed or discovered (also called "bugtracker")
- **Planned Features** — ideas or future functionality to build

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

## Step 3: Write the note

Format the note as a single bullet point: a short, clear sentence that captures the essential information. Aim for 1–2 sentences max. Write it the way an experienced developer would jot it down — precise, no filler.

Good: `- **Inventory reset on reconnect**: Player inventory is wiped when they disconnect and rejoin because the server keys it to socket ID rather than a stable player identity.`

Bad: `- The user said there might be an issue where inventory goes away sometimes.`

Append the bullet to the correct section in `state.md`. Find the section header (e.g. `## Known Bugs`) and add the new bullet at the end of that section's existing list, before the next `---` or `##` heading.

If the section currently says something like `_All known tech debt resolved_` or is otherwise empty/placeholder text, replace that placeholder line with your new bullet point.

---

## Step 4: Confirm

Tell the user what you wrote and where, in one short sentence. For example:

> Added to **Known Bugs** in `projects/metagross/plan.md`: inventory resets on reconnect because it's keyed to socket ID.
