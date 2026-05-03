---
name: absol-newproject
description: "Scaffolds a new project for the absol pipeline with all required MD files (CLAUDE.md, state.md, vision.md, roadmap.md, plan.md, todo.md, todo-run.md, inbox.md), Docker files (Dockerfile, docker-compose.yml, nginx.conf, .dockerignore), .gitignore, and git init. Use this skill whenever the user wants to start a new project, create a project, scaffold a project, init a project, or set up a new project. Trigger on phrases like 'new project', 'start a project', 'scaffold', 'create a project', 'init project', 'set up a new project', or when the user describes a project idea and wants to get started building it. This skill handles ONLY the project skeleton and MD files — it does NOT select languages, frameworks, or create package.json/tsconfig. The absol pipeline handles all actual implementation after scaffolding."
---

# absol-newproject

Scaffold a new project directory with everything the absol pipeline needs to start working.

## What This Skill Does

Creates a project folder under `/mnt/nas/dev/projects/<name>/` with:
- All absol pipeline MD files (pre-populated where appropriate)
- Docker deployment files (Dockerfile, docker-compose.yml, nginx.conf, .dockerignore)
- A .gitignore
- An initialized git repo

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
mkdir -p /mnt/nas/dev/projects/<name>
```

### Step 4: Write All Files

Write these files using the Write tool. All templates below use `{name}` for the project name, `{description}` for the user's project idea, `{port}` for the allocated port, and `{date}` for today's date.

---

### CLAUDE.md

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

| File | Purpose |
|---|---|
| `state.md` | **Current development state.** What was just worked on, what's in progress, context notes, tech debt, planned features, and known bugs. Updated at the end of every session ("wrap up"). |
| `todo.md` | **Actionable tasks.** Concrete, discrete things to do — bugs to fix, features to implement. |
| `vision.md` | **High-level vision, design philosophy, and project brief.** |
| `plan.md` | **Scratchpad for active planning, design decisions, and working notes.** |
| `roadmap.md` | **Phased roadmap.** Implementation phases, milestones, and long-term direction. |
| `inbox.md` | **Triaged feature requests.** Incoming work items classified by the absol pipeline. |
| `todo-run.md` | **Execution run tracking.** Job results from absol pipeline runs. |

## Git

- **Repo:** TBD
- Commit only when explicitly asked. Use short, descriptive commit messages.
- Never commit `.env`, credentials, or large binary assets.
- Do not force-push to `main`.

## Wrap-Up Rule

When asked to **wrap up**, update `state.md` and `todo.md` to reflect all code changes made in the session — what was done, what's in progress, and what actionable tasks remain. Also update `plan.md`: when a phase or task is completed, compact it into a short summary under the **Completed** section at the bottom of the file.
```

---

### vision.md

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

### state.md

```markdown
# {Name} — Current State

*Last updated: {date}*

## Last Session

Project scaffolded via absol-newproject. No code written yet.

## In Progress

Nothing — ready for absol pipeline.

## Tech Debt

None yet.

## Known Bugs

None yet.

## Planned Features

See vision.md for project goals. Run absol pipeline to triage and plan implementation.
```

---

### roadmap.md

```markdown
# {Name} — Roadmap

No phases completed yet. Run absol pipeline to begin planning.
```

---

### plan.md

```markdown
# {Name} — Plan

No active plans yet. Run absol pipeline to triage work and generate plans.
```

---

### todo.md

```markdown
# {Name} — Tasks

No tasks yet — run absol pipeline to generate.
```

---

### inbox.md

```markdown
# {Name} — Inbox

No items yet.
```

---

### todo-run.md

```markdown
# todo-run.md — cleared after scaffolding on {date}
```

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
```

---

### Step 5: Initialize Git

```bash
cd /mnt/nas/dev/projects/<name> && git init
```

### Step 6: Confirm & Next Steps

After all files are written, tell the user:

1. Project scaffolded at `/mnt/nas/dev/projects/<name>/`
2. Docker port allocated: `{port}`
3. List the files created
4. Suggest next step: "You can now run the absol pipeline on this project to triage your idea, plan the implementation, and start building."

## Important Rules

- **No language/framework decisions.** Don't create package.json, tsconfig, requirements.txt, or any code files. The absol pipeline handles tech choices during planning.
- **No code files.** This skill creates only MD files, Docker files, .gitignore, and git init.
- **Normalize project names.** Convert spaces to hyphens, uppercase to lowercase.
- **Port scanning is required.** Always check existing projects before assigning a port. Don't hardcode ports.
- **Populate vision.md meaningfully.** The user's project description should flow into vision.md so the absol pipeline has context to work with. Don't just write "TBD" — use what the user gave you.
