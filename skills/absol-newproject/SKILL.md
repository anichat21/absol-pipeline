---
name: absol-newproject
description: Scaffolds a new absol project — root CLAUDE.md (brief + Shipping & Git baseline) + state.md, docs/ + references/, and .absol/ with CONTEXT.md, adr/, the three ledger files, archive/, reviews/ — plus .gitignore and git init. Skeleton and MD files only; no language or framework choices. Use on 'new project', 'scaffold', 'set up a project', or when the user describes an idea to start building.
---

# absol-newproject

Create `projects/<slug>/` (lowercase slug; ask if the name is ambiguous). Ask only what the
templates need and the user hasn't said: one-line purpose, stack if known, anything to seed
CONTEXT.md. Skip questions the conversation already answered.

## Layout

```
<slug>/
├── CLAUDE.md          project brief + binding ops rules (user-owned)
├── state.md           truth snapshot (finalizer-owned)
├── docs/              hosted/working docs — hub-registered HTML (absol-docs owns the hub)
├── references/        project info files — source PDFs, corpus dumps, study mds
└── .absol/
    ├── CONTEXT.md     domain glossary, lazy-grown
    ├── adr/0000-template.md
    ├── inbox.md  bugs.md  tech-debt.md     ← the ledger (empty placeholders)
    ├── archive/       finalizer appends archive/YYYY-MM.md per month
    └── reviews/       review & research artifacts (megareview reports, research overflow)
```

`docs/` vs `references/` is the workspace-wide convention (absol-docs owns it): `docs/` is what
the project publishes; `references/` is what the project consumes. Always these two names —
never `Reference/`, `archives/`, or per-project inventions. Scaffold both with a `.gitkeep`.

`run.md` is created per run by orchestrate/scratchpad — never scaffolded.

## Templates (keep them this small)

**CLAUDE.md** — `# <Name>` + one-paragraph brief, `## Stack` (or "TBD"), `## Pipeline
Commands` with `verify:` / `smoke:` stubs ("TBD — fill before first pipeline run"), a
one-line pointer: *"Workflow: absol. Ledger in `.absol/`; schemas in the absol skill."*, and
`## Shipping & Git` carrying the workspace-default ops rules:

> Version and artifact filename bump together; a ship isn't done until its smoke runs or is
> recorded as owed in the smoke ledger; absol owns git flow (pre/post-run commits are
> automatic; push only when asked); `main` is the release branch unless stated otherwise here.

Projects override individual lines in place where genuinely different — the section always
exists. Ops rules live in CLAUDE.md only; CONTEXT.md is domain glossary, never ops. Git-flow
rules never live in project docs (doctrine: `~/.claude/skills/absol/references/doctrine.md`).

**state.md** — `# <Name> — Current State`, `*Last updated: <date>*`, `## Last Session` →
"Project scaffolded.", `## Open Threads` → "None."

**CONTEXT.md** — `# <Name> — Domain Context`, `- maturity: scaffold` (the ceremony dial —
doctrine; the owner flips it as the project hardens), then seeded terms if the user gave any,
else "*Grown by shaper/architect as terms are named.*"

**adr/0000-template.md** — standard ADR skeleton (Status: draft | accepted | superseded /
Context / Decision / Consequences). Drafts come from any skill mid-conversation; the architect
ratifies.

**Ledger files** — `# <Name> — {Inbox|Bugs|Tech Debt}` + `None.` (the schema's empty-ledger placeholder)

**.gitignore** — `.absol/run.md` only. Everything else — ledger (it carries shaped human
decisions), archive, reviews — is tracked; that's the safety net.

## Finish

`git init` + initial commit ("Scaffold absol project"). Report the tree in ≤6 lines and point
at the natural next step: capture ideas via note-taker, then `/absol` to run. If the user
described concrete ideas during setup, offer to capture them as inbox items now.
