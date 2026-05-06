---
name: absol-newproject
description: "Scaffolds a new project for the absol pipeline with the .absol/ layout — root holds CLAUDE.md, state.md, vision.md, roadmap.md; .absol/ holds CONTEXT.md, adr/, inbox.md, plan.md, todo.md, todo-run.md, bugs.md, tech-debt.md, archive/. Also writes Docker files, .gitignore, and runs git init. Use whenever the user wants to start, create, scaffold, init, or set up a new project. Trigger on phrases like 'new project', 'start a project', 'scaffold', 'create a project', 'init project', 'set up a new project', or when the user describes a project idea and wants to get started building it. Handles ONLY skeleton + MD files — no language/framework choices. The absol pipeline handles implementation."
---

# absol-newproject

Scaffold a new project at `/mnt/nas/dev/projects/<name>/` with the `.absol/` layout, Docker files, `.gitignore`, and `git init`.

Layout written:

```
<name>/
├── CLAUDE.md  state.md  vision.md  roadmap.md          (root, tracked)
├── Dockerfile  docker-compose.yml  nginx.conf  .dockerignore
├── .gitignore
└── .absol/
    ├── CONTEXT.md  bugs.md  tech-debt.md  adr/0000-template.md   (tracked)
    ├── inbox.md  plan.md  todo-run.md                            (gitignored)
    └── archive/                                                  (gitignored)
```

## Inputs

- **Project name** — lowercase, hyphenated. Normalise spaces → hyphens, uppercase → lowercase.
- **Project description** — flows into vision.md and CLAUDE.md. Don't write "TBD"; use what the user gave you.

If either is missing, ask one focused question. Don't run a questionnaire.

## Allocate port

```bash
grep -rh 'ports:' -A1 /mnt/nas/dev/projects/*/docker-compose.yml 2>/dev/null | grep -oP '\d+(?=:80)' | sort -n
```

Pick the next free port from 8180 up. If nothing is allocated, start at 8180.

## Create directories

```bash
mkdir -p /mnt/nas/dev/projects/<name>/.absol/adr /mnt/nas/dev/projects/<name>/.absol/archive
```

## Write files

Templates use `{name}`, `{description}`, `{port}`, `{date}` placeholders.

---

### CLAUDE.md  (root)

```markdown
# {Name} — Project Overview

{description}

## Stack

| Layer | Choice |
|---|---|
| Frontend | TBD |
| Backend | TBD |
| State | TBD |
| Deployment | Docker, Proxmox VM, Cloudflare Tunnel + Access |

## How to Run

### Local
```bash
# TBD — will be filled in during planning
```

### Docker
```bash
docker compose up --build
```

## Rebuild & Restart Docker

```bash
docker compose down && docker compose up --build -d
```

App runs on `http://localhost:{port}`.

## Architecture

```
src/
  # TBD — will be filled in during planning
```

## Project MD Files

Root (human-facing, tracked):

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project meta, stack, run commands. |
| `state.md` | Truth snapshot. Last session, in progress, parked items. Finalizer-owned. |
| `vision.md` | High-level vision, design philosophy, project brief. |
| `roadmap.md` | Phased roadmap and milestones. |

`.absol/` (pipeline-owned, hidden):

| File | Purpose | Tracked |
|---|---|---|
| `CONTEXT.md` | Domain glossary. Lazy-grown. | yes |
| `adr/` | Architecture Decision Records. Architect-only writes. | yes |
| `bugs.md` | Known bugs. Removed when their owning plan completes (or via "won't fix" ADR). | yes |
| `tech-debt.md` | Known debt. Removed when their owning plan completes; reviewed by `/absol-architect`. | yes |
| `inbox.md` | Active intake. Items removed when their owning plan/scratchpad completes. | no |
| `plan.md` | Plan Queue — PLAN-NNN entries with seeds + execution tasks. Cleared per run by finalizer. | no |
| `todo-run.md` | Live execution journal. Cleared per run by finalizer. | no |
| `archive/` | Finalizer snapshots — `run-{run_id}.md` is the only durable run history. | no |

## Git

- **Repo:** TBD
- Commit only when explicitly asked.
- Never commit `.env`, credentials, or large binary assets.
- Don't force-push `main`.

## Capture as we discuss

When the user is brainstorming features, bugs, or improvements in conversation (rather than asking to build right now), log them via the `note-taker` skill so they don't get lost. note-taker routes: bugs → `.absol/bugs.md`, tech debt → `.absol/tech-debt.md`, anything else → `.absol/inbox.md` as `status: new`. Default to inbox when ambiguous. Don't break flow to ask — note in passing, confirm in one line, keep the conversation going.

## Wrap-Up

Don't edit pipeline state files by hand. The absol-finalizer skill runs end-of-session: archives `todo-run.md` to `.absol/archive/run-{run_id}.md`, removes done plans from `plan.md`, removes notes whose owning plan completed, updates `state.md` as a current-truth snapshot.
```

---

### vision.md  (root)

```markdown
# {Name} — Vision

## Overview

{description}

## Core Concept

<!-- What is the core idea? What problem does it solve? Who is it for? -->
TBD — flesh out during planning.

## Design Philosophy

- TBD

## Constraints

- Browser-based deployment via Docker + Cloudflare Tunnel
- Must run on Proxmox VM infrastructure
```

---

### state.md  (root)

```markdown
# {Name} — Current State

*Last updated: {date}*

## Last Session

Project scaffolded via absol-newproject. No code written yet.

## In Progress

Nothing — ready for absol pipeline.

## Parked Items

None.
```

`state.md` doesn't carry Tech Debt / Known Bugs / Planned Features sections. Those live in `.absol/tech-debt.md`, `.absol/bugs.md`, `.absol/inbox.md`.

---

### roadmap.md  (root)

```markdown
# {Name} — Roadmap

No phases completed yet. Run absol pipeline to begin planning.
```

---

### .absol/CONTEXT.md

```markdown
# {Name} — Context Glossary

Domain terms and naming conventions. Every absol agent reads this at start of run. Lazy-grown by `/absol-shaper`, `/absol-architect`, `note-taker`. Edit by hand any time.

## Domain Terms

<!-- Format: **Term** — definition. Use for X. Don't say Y or Z. -->

None yet.

## Naming Conventions

- File names: TBD
- Component names: TBD
- Prefixes: TBD
```

---

### .absol/adr/0000-template.md

```markdown
# ADR-0000 — Template

**Status:** template — copy as `NNNN-short-slug.md` for new decisions.

## Status
proposed | accepted | superseded by ADR-NNNN

## Context
What problem are we facing? What constraints?

## Decision
What did we choose?

## Consequences
What tradeoffs did we accept? What does this make easier or harder?
```

---

### .absol/inbox.md

```markdown
# {Name} — Inbox

No items yet.
```

### .absol/plan.md

```markdown
# {Name} — Plan Queue

No active plans. Run `/absol` and choose pipeline mode to plan from inbox/bugs/tech-debt.
```

### .absol/todo-run.md

```markdown
# todo-run.md — cleared after scaffolding on {date}
```

### .absol/bugs.md

```markdown
# {Name} — Known Bugs

No known bugs. Add via `note-taker`. Bugs are removed when their owning plan/scratchpad completes (a fix-task lands), or when an ADR records the decision not to fix.
```

### .absol/tech-debt.md

```markdown
# {Name} — Tech Debt

No tech debt logged. Add via `note-taker`. Removed when their owning plan completes. Reviewed by `/absol-architect`: top items get promoted to `inbox.md` as actionable or get ADR'd as accepted shape.
```

### .absol/archive/.gitkeep

Empty file. Marks the folder so the finalizer doesn't have to mkdir on first run. (The folder is gitignored, so the .gitkeep won't track — create it anyway as a marker.)

---

### Dockerfile

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### docker-compose.yml

```yaml
services:
  {name}:
    build: .
    ports:
      - "{port}:80"
    restart: unless-stopped
```

### nginx.conf

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### .dockerignore

```
node_modules
dist
.git
.absol
*.md
```

### .gitignore

```
node_modules/
dist/
.env
.env.*
*.log
.DS_Store
@eaDir/

# absol pipeline churn — recovers from finalize, no value in git history
.absol/inbox.md
.absol/plan.md
.absol/todo-run.md
.absol/archive/
```

Tracked inside `.absol/`: `CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`.

---

## Init git & confirm

```bash
cd /mnt/nas/dev/projects/<name> && git init
```

Tell the user: project path, port allocated, files created (root + `.absol/`), suggest *"Run /absol on this project to open a session and start capturing notes or planning."*

## Rules

- No code files (no `package.json`, `tsconfig`, `requirements.txt`, etc.). The pipeline picks the stack during planning.
- No language/framework decisions.
- Always allocate a port via the scan — don't hardcode.
- Populate `vision.md` meaningfully from the user's description.
- Pipeline owns `.absol/inbox.md`, `plan.md`, `todo-run.md`, `archive/`. The user can edit `CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`.
