---
name: absol-newproject
description: "Scaffolds a new project for the absol pipeline with the .absol/ layout — root holds CLAUDE.md, state.md, vision.md, roadmap.md; .absol/ holds CONTEXT.md, adr/, inbox.md, plan.md, todo.md, todo-run.md, bugs.md, tech-debt.md, archive/. Also writes Docker files (Dockerfile, docker-compose.yml, nginx.conf, .dockerignore), .gitignore, and runs git init. Use this skill whenever the user wants to start a new project, create a project, scaffold a project, init a project, or set up a new project. Trigger on phrases like 'new project', 'start a project', 'scaffold', 'create a project', 'init project', 'set up a new project', or when the user describes a project idea and wants to get started building it. This skill handles ONLY the project skeleton and MD files — it does NOT select languages, frameworks, or create package.json/tsconfig. The absol pipeline handles all actual implementation after scaffolding."
---

# absol-newproject

Scaffold a new project directory with everything the absol pipeline needs to start working.

## What This Skill Does

Creates a project folder under `/mnt/nas/dev/projects/<name>/` with the absol `.absol/` layout:

- **Root** (human-facing, version-controlled): `CLAUDE.md`, `state.md`, `vision.md`, `roadmap.md`
- **`.absol/`** (pipeline-owned, hidden — convention matches `.git/`, `.github/`):
  - `CONTEXT.md` — empty domain glossary, lazy-grown by grill-me / architect / note-taker
  - `adr/0000-template.md` — Architecture Decision Record template
  - `inbox.md`, `plan.md`, `todo.md`, `todo-run.md` — pipeline state (gitignored)
  - `bugs.md`, `tech-debt.md` — durable issue/debt logs (tracked)
  - `archive/` — finalizer's archive folder (gitignored)
- Docker files (`Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.dockerignore`)
- `.gitignore` with the absol churn-files ignored
- An initialised git repo

This skill is the **entry point** before the absol pipeline. After scaffolding, the user runs absol-orchestrate to triage, plan, and execute actual implementation work.

## Workflow

### Step 1: Gather Input

You need two things from the user. They may have already provided these in their message — extract them if so, don't re-ask unnecessarily.

1. **Project name** — lowercase, hyphenated (e.g. `my-cool-app`). If the user gives a name with spaces or mixed case, normalize it.
2. **Project idea / description** — a brief description of what the project is. This populates vision.md and CLAUDE.md. Can be a sentence or a paragraph.

If either is missing, ask. Keep it brief — one question, not a questionnaire.

### Step 2: Find Next Available Port

Scan all existing `docker-compose.yml` files under `/mnt/nas/dev/projects/` to find which host ports are already mapped. Pick the next available port starting from 8180, incrementing by 1. Use this command:

```bash
grep -rh 'ports:' -A1 /mnt/nas/dev/projects/*/docker-compose.yml 2>/dev/null | grep -oP '\d+(?=:80)' | sort -n
```

If no ports are found, start at 8180.

### Step 3: Create Project Directory

```bash
mkdir -p /mnt/nas/dev/projects/<name>/.absol/adr /mnt/nas/dev/projects/<name>/.absol/archive
```

### Step 4: Write All Files

Write these files using the Write tool. All templates below use `{name}` for the project name, `{description}` for the user's project idea, `{port}` for the allocated port, and `{date}` for today's date.

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
| `CLAUDE.md` | This file. Project meta, stack, run commands. |
| `state.md` | **Current truth snapshot.** Last session, in progress, parked items. Updated by the finalizer. |
| `vision.md` | High-level vision, design philosophy, project brief. |
| `roadmap.md` | Phased roadmap and milestones. |

`.absol/` (pipeline-owned, hidden):

| File | Purpose | Tracked |
|---|---|---|
| `CONTEXT.md` | **Domain glossary.** Names of concepts in this project, definitions, naming conventions. Lazy-grown. | yes |
| `adr/` | **Architecture Decision Records.** One file per load-bearing decision. Only the architect skill writes ADRs. | yes |
| `bugs.md` | Known bugs. Removed only by fix-and-task or "won't fix" ADR. | yes |
| `tech-debt.md` | Known debt. Reviewed by `/absol-architect` to promote into tasks or ADR away. | yes |
| `inbox.md` | Active intake. Items at `status: new`, `needs-shaping`, or `shaped`. | no (gitignored) |
| `plan.md` | Shaped items with PRD sub-fields (modules, testing, out_of_scope). | no (gitignored) |
| `todo.md` | Executable tasks. | no (gitignored) |
| `todo-run.md` | Live execution log. | no (gitignored) |
| `archive/` | Finalizer-snapshotted history (per-run inbox snapshots, run logs, monthly session summaries). | no (gitignored) |

## Git

- **Repo:** TBD
- Commit only when explicitly asked. Use short, descriptive commit messages.
- Never commit `.env`, credentials, or large binary assets.
- Do not force-push to `main`.

## Wrap-Up Rule

When asked to **wrap up**, the absol-finalizer skill runs end-of-session: updates `state.md`, snapshots `inbox.md` promoted items into `.absol/archive/`, snapshots `todo-run.md`, compacts old session entries, clears resolved todos. Don't edit pipeline state files by hand — let finalize own them.
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

Note: `state.md` no longer carries Tech Debt, Known Bugs, or Planned Features sections. Those live in `.absol/tech-debt.md`, `.absol/bugs.md`, and `.absol/inbox.md` respectively. The finalizer keeps `state.md` a clean truth snapshot.

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

Domain terms and naming conventions for this project. Every absol agent reads this file at start of run.

This file is lazy-grown: `/grill-me`, `/absol-architect`, and `note-taker` add terms when new concepts are named or sharpened. Edit by hand any time.

## Domain Terms

<!--
Format:
**Term** — definition. Use for X. Don't say Y or Z.
-->

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

**Status:** template — copy this file as `NNNN-short-slug.md` for new decisions.

## Status

proposed | accepted | superseded by ADR-NNNN

## Context

What problem are we facing? What constraints are in play?

## Decision

What did we choose?

## Consequences

What tradeoffs did we accept? What does this make easier? What does this make harder? What are we no longer able to reconsider casually?
```

---

### .absol/inbox.md

```markdown
# {Name} — Inbox

No items yet.
```

---

### .absol/plan.md

```markdown
# {Name} — Plan

No active plans yet. Run absol pipeline to triage work and generate plans.
```

---

### .absol/todo.md

```markdown
# {Name} — Tasks

No tasks yet — run absol pipeline to generate.
```

---

### .absol/todo-run.md

```markdown
# todo-run.md — cleared after scaffolding on {date}
```

---

### .absol/bugs.md

```markdown
# {Name} — Known Bugs

No known bugs. Add via `note-taker` (e.g. "note that X is broken because Y") or via the pipeline reviewer.

Each entry follows the absol note schema (see absol README). Bugs are removed only when fixed (and a task records the fix) or when an ADR records the decision not to fix.
```

---

### .absol/tech-debt.md

```markdown
# {Name} — Tech Debt

No tech debt logged. Add via `note-taker` ("note this as tech debt: …").

Reviewed by `/absol-architect` runs: top items get promoted into `inbox.md` as actionable tasks or get ADR'd as accepted shape.
```

---

### .absol/archive/.gitkeep

(Empty file — preserves the folder so finalizer doesn't have to mkdir on first run. The folder itself is gitignored so the .gitkeep won't actually be tracked; create it anyway as a marker.)

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

---

### docker-compose.yml

```yaml
services:
  {name}:
    build: .
    ports:
      - "{port}:80"
    restart: unless-stopped
```

---

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

---

### .dockerignore

```
node_modules
dist
.git
.absol
*.md
```

---

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
.absol/todo.md
.absol/todo-run.md
.absol/archive/
```

Tracked inside `.absol/`: `CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`. These are decision-bearing or human-readable artefacts a future contributor needs.

---

### Step 5: Initialize Git

```bash
cd /mnt/nas/dev/projects/<name> && git init
```

### Step 6: Confirm & Next Steps

After all files are written, tell the user:

1. Project scaffolded at `/mnt/nas/dev/projects/<name>/`
2. Docker port allocated: `{port}`
3. List the files created (root + `.absol/`)
4. Suggest next step: "You can now run the absol pipeline on this project to triage your idea, plan the implementation, and start building."

## Important Rules

- **No language/framework decisions.** Don't create package.json, tsconfig, requirements.txt, or any code files. The absol pipeline handles tech choices during planning.
- **No code files.** This skill creates only MD files, Docker files, .gitignore, and git init.
- **Normalize project names.** Convert spaces to hyphens, uppercase to lowercase.
- **Port scanning is required.** Always check existing projects before assigning a port. Don't hardcode ports.
- **Populate vision.md meaningfully.** The user's project description should flow into vision.md so the absol pipeline has context to work with. Don't just write "TBD" — use what the user gave you.
- **`.absol/` ownership.** Everything inside `.absol/` is pipeline territory. The user shouldn't edit `inbox.md`, `plan.md`, `todo.md`, or `todo-run.md` directly during normal use — the pipeline owns them. `CONTEXT.md`, `bugs.md`, `tech-debt.md`, and `adr/` are durable and user-editable.
