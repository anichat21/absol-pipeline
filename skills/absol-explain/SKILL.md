---
name: absol-explain
description: Explains absol briefly and simply — the ledger, the three modes, the execute gate, who writes what. Use on '/absol-explain', 'explain absol', 'what is absol', 'how does absol work', or when a fresh context needs a one-minute orientation.
---

# absol-explain

Explain absol in under a minute of reading. No file dumps, no schemas — the concept:

**absol** is a project workflow for Claude Code: ideas go in as ledger items, work comes out
as verified, archived runs.

- **The ledger** (`.absol/inbox.md` / `bugs.md` / `tech-debt.md`): every piece of work is an
  item that grows in place — `shape:` (your decisions), `map:` (codebase research), `plan:`
  (tasks). Tools write the blocks; you never do bookkeeping by hand.
- **Three modes**, routed by `/absol`: **note-taker** captures thoughts into items;
  **scratchpad** is interactive work with you driving; a **run** is the unattended pipeline.
- **The execute gate**: "run item X" checks shape/map/plan and auto-fills whatever's missing —
  only shaping can need you, so AFK and scheduled runs skip-and-report unshaped items instead
  of guessing.
- **A run**: execute serially → review flagged work → verify honestly (unit / runtime probe /
  owed-to-human) → finalize: outcome appended to `archive/YYYY-MM.md`, done items deleted,
  `state.md` snapshot refreshed, `run.md` removed (its existence is the only "run live" flag).

If the user asked about one piece, answer just that, plainly. For the real spec, point at that
piece's SKILL.md (schemas live in `absol/references/schemas.md`) instead of paraphrasing it.
