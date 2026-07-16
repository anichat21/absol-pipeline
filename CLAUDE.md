# absol — the pipeline itself

This repo *is* the absol system: skills, agents, doctrine. It is **not** an absol-managed
project — no `.absol/` here, ever. Work happens directly in conversation, with the working
material below.

## Working on this repo

- **Read `meta/authoring.md` before editing anything in `skills/` or `agents/`.**
- Truth homes: schemas → `skills/absol/references/schemas.md`; conduct →
  `skills/absol/references/doctrine.md`; model routing evidence → `meta/model-doctrine.md`.
  Point at them, never restate.
- `feedback/` is the intake: dated problem reports written by absol-feedback from any
  project. Sweeping it is part of working here — fold each note into the skills, then
  delete it (git history is the record).
- A skill edit is live the moment the file saves (symlinks, no build). Commit when the
  owner asks; never push.

## Folder map

| Folder | Holds |
|---|---|
| `skills/` `agents/` | the shipped system — symlinked into `~/.claude/skills/` and `~/.claude/agents/` |
| `meta/` | the repo's own working material: `authoring.md`, `model-doctrine.md` |
| `feedback/` | dated problem reports (absol-feedback inbox) — swept, not accumulated |
| `docs/` | hub-hosted HTML only (`http://aidev:8080/docs/`) |
| `references/` | external source material consumed here |
