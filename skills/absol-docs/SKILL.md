---
name: absol-docs
description: Manage the hosted project documentation served by homer (http://aidev:8080/docs/). Scaffolds new project doc folders, registers them in the central docs hub, swaps per-project themes. User-invoked. Use when the user says `/absol-docs`, "add docs to <project>", "register <project> in the docs hub", "theme <project>", "set up the docs hub", or otherwise asks to create, register, restyle, or rewire a hosted HTML doc. Not for `.absol/` pipeline files — those are owned by other absol skills.
---

# absol-docs

Own the **hosted project documentation** for this workspace. Project docs live as self-contained HTML files in each project's `docs/`; homer bind-mounts them and serves a hub page at `http://aidev:8080/docs/` that lists every registered project. This skill scaffolds new docs, edits the central registry, wires up the docker mount, and swaps the per-project theme.

User-invoked only. Other absol skills never call this one — the pipeline doesn't need to know about hosted docs, and the two concerns are kept apart on purpose.

## Architecture

The hub, the shared CSS/JS, the doc template, and the registry all live inside this skill's `assets/` directory. Homer bind-mounts that directory at `/www/docs/_assets`, so shared assets are addressable at `/docs/_assets/...`. The leading underscore keeps it from colliding with project slugs.

```
absol-docs/assets/
├── index.html              → served at  /docs/                (the hub)
├── docs-registry.json      → drives the hub's card list
├── css/
│   ├── base.css            → tokens, fonts, reset           (every page)
│   ├── index.css           → hub-only: card grid + accordion
│   ├── doc.css             → project doc pages
│   └── themes/             → optional per-project token overrides
│       └── <slug>.css      → redefines :root tokens for one project
├── js/
│   └── docs.js             → mermaid + hover anchors        (every doc page)
└── templates/
    └── doc.html            → starter for a new project doc
```

Per-project doc files still live in `<project>/docs/` and are bind-mounted into homer at `/www/docs/<project>/`, one mount per project. Only the hub index and shared assets live in the skill.

**The registry is the source of truth.** `docs-registry.json` is what the hub reads at load to render cards — edit a file but skip the registry and the hub won't show it. Always update both.

**Themes are optional per-project token overrides.** A project entry can carry `"theme": "<slug>.css"`; when set, every doc page for that project loads `themes/<slug>.css` as a third stylesheet after `doc.css`, redefining colors and fonts on `:root`. Without a theme, the project inherits the default look. Themes should mostly stick to design tokens — layout and utility classes stay shared so the structure feels familiar across projects. See `themes/README.css` for the convention and an example skeleton.

## Four intents

The user invokes `/absol-docs` with one of the intents below. If which one is unclear, ask. Never run `docker compose up -d` yourself — mount changes need a container recreate; file edits inside an existing mount are live on refresh. Tell the user when a recreate is needed and let them run it.

## add — register a brand-new project

The project exists at `/mnt/nas/dev/projects/<project>/` but has no `docs/` folder yet, or has one that isn't wired into homer.

Confirm the project directory exists. If it doesn't, use **`AskUserQuestion`** for the correct path or slug — don't guess.

Ask the user for display name (default: slug title-cased), one-line description, and a Font Awesome icon class (default `fas fa-file-code`). Recommend defaults; don't grill.

Check `themes/`. If theme files exist beyond `README.css`, use **`AskUserQuestion`** to pick one, scaffold a new empty theme from the README skeleton, or stick with the default look. Surface this at scaffold time because applying a theme later means rewriting every page's `<link>` tags — cheaper to decide now.

If `<project>/docs/index.html` doesn't exist, copy the doc template into it and substitute `{{TITLE}}` / `{{PROJECT_NAME}}` / `{{SUBTITLE}}`. If a theme was chosen, insert this line after the `doc.css` link:

```html
<link rel="stylesheet" href="/docs/_assets/css/themes/<theme>.css">
```

Append the project to the registry. Include `"theme"` only if one was chosen:

```json
{
  "slug": "<project>",
  "name": "<display name>",
  "icon": "<fa class>",
  "description": "<one-liner>",
  "theme": "<theme>.css",
  "docs": [{ "title": "Index", "path": "index.html" }]
}
```

Add a bind mount under the homer service's `volumes:` in `homer/docker-compose.yml`. Insert alongside the existing project mounts; preserve YAML indentation exactly:

```yaml
- ../<project>/docs:/www/docs/<project>:ro
```

Then tell the user: *"Mount added — run `docker compose up -d` in `homer/` to pick up the new volume."*

## page — add a doc page to a registered project

Verify the project is in the registry. If not, suggest `/absol-docs add <project>` first.

Derive a filename: lowercase the title, hyphenate, append `.html` (e.g. *"Build runbook"* → `build-runbook.html`). If the title is ambiguous, confirm via **`AskUserQuestion`**.

Copy the doc template into `<project>/docs/<filename>`, substitute placeholders. If the project's registry entry has a `theme` field, insert the same theme `<link>` line that already exists on its other pages — match exactly so the project stays visually consistent.

Append `{ "title": "<title>", "path": "<filename>" }` to the project's `docs:` list.

No docker recreate needed — mounted directories pick up new files live. The page is at `http://aidev:8080/docs/<project>/<filename>`.

## theme — assign, swap, or remove a project's theme

Verify the project is in the registry. If not, suggest `add` first.

List the available themes in `themes/` (skip `README.css`). If a theme name was supplied, validate it exists; if not, use **`AskUserQuestion`** to pick one, scaffold a fresh empty theme from the README skeleton, or remove the theme entirely.

Update every `<project>/docs/*.html`:

- Switching to a theme: ensure exactly one theme `<link>` exists after `doc.css`. Replace it if a different theme is already there; insert it if none.
- Removing: delete any existing `themes/*.css` link.

Update the project's registry entry: set `"theme": "<theme>.css"` or remove the field.

No docker recreate needed. The new look is live on refresh.

## setup — one-time rewire of homer to use the new hub

Switches homer from per-project Docs cards on the dashboard to a single Documentation card pointing at the hub, and mounts the skill's assets. Idempotent — check before editing.

In `homer/docker-compose.yml`, remove any old `./docs-template:/www/docs/_template:ro` mount (the template lives in this skill now), and add the hub mounts. Use repo-relative paths so docker doesn't follow symlinks into a home dir:

```yaml
- ../absol/skills/absol-docs/assets:/www/docs/_assets:ro
- ../absol/skills/absol-docs/assets/index.html:/www/docs/index.html:ro
```

In `homer/config/config.yml`, replace the entire `Docs` services group with one item:

```yaml
- name: "Docs"
  icon: "fas fa-book"
  items:
    - name: "Documentation"
      icon: "fas fa-book-open"
      subtitle: "Project documentation hub"
      tag: "all docs"
      url: "http://aidev:8080/docs/"
      target: "_blank"
```

Tell the user: *"Run `docker compose up -d` in `homer/` once to pick up the new mounts. After that, edits to anything under the skill's `assets/` are live on refresh."*

Offer to update `homer/CLAUDE.md` to point at this skill as the doc-management entry. Apply only on confirmation via **`AskUserQuestion`** — that's user-facing prose, not skill state, and they may want to phrase it themselves.

## Rules

- User-invoked only. Never auto-trigger from absol-orchestrate, absol-planner, absol-finalizer, etc. — hosted docs and pipeline state are separate concerns and crossing them couples two unrelated systems.
- Never run docker commands. Tell the user when a recreate is needed. Container state is theirs to manage.
- All new docs are single self-contained HTML files. No markdown — the template handles structure; the user fills content.
- The registry is the source of truth for the hub. A doc that exists on disk but isn't in the registry doesn't show up.
- Don't touch `.absol/` pipeline files. This skill stays in the project's `docs/` folder and the skill's own `assets/`.
- Themes should redefine design tokens by default. Scoped chrome (a pseudo-element keyed to a class only that project uses) is fine when the theme calls for it; broad layout rewrites that fight `doc.css` are not — they break the family resemblance across projects.
