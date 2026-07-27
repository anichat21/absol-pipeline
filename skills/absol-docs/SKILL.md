---
name: absol-docs
description: Manage the hosted project documentation served by homer (http://aidev:8080/docs/). Scaffolds new project doc folders, registers them in the central docs hub, swaps per-project themes. Owns the workspace docs/-vs-references/ folder convention. User-invoked. Use when the user says `/absol-docs`, "add docs to <project>", "register <project> in the docs hub", "theme <project>", "set up the docs hub", asks where reference material belongs, or otherwise asks to create, register, restyle, or rewire a hosted HTML doc. Not for `.absol/` pipeline files — those are owned by other absol skills.
---

# absol-docs

**Retired (homer sunset 2026-07-27):** ArcticTern (`aidev:8191`) serves the docs URL space with a
filesystem-generated registry; authoring rules live in `~/.claude/skills/absol/references/knowledge.md`.
This skill's `assets/` (css/js/templates) remain the live source ArcticTern serves at `/docs/_assets/`
— keep maintaining those. The registry-editing and compose-mount procedures below are dead; do not
perform them.

Own the **hosted project documentation** for this workspace. Project docs live as self-contained HTML files in each project's `docs/`; homer bind-mounts them and serves a hub page at `http://aidev:8080/docs/` that lists every registered project. This skill scaffolds new docs, edits the central registry, wires up the docker mount, and swaps the per-project theme.

User-invoked only. Other absol skills never call this one — the pipeline doesn't need to know about hosted docs, and the two concerns are kept apart on purpose.

## The docs / references convention (this skill owns it)

Every project entry has at most two doc-ish folders, always these names:

- **`docs/`** — what the project *publishes*: working/hosted HTML, hub-registered. The only folder this skill's intents operate on.
- **`references/`** — what the project *consumes*: source PDFs, corpus dumps, study mds, client contracts. Plain files, lowercase folder name, never hub-registered by default — on request, individual reference files can be registered as doc pages (copy/convert into `docs/`, don't mount `references/` itself).

No per-project inventions (`Reference/`, `archives/`, etc.) — when you meet one, suggest the rename. A file that describes the project's own systems goes in `docs/`; a file the project learns from goes in `references/`. absol-newproject scaffolds both.

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

Per-project doc files live under one of two workspace roots:

- **`projects/<slug>/docs/`** — entries with `"category": "project"` (default). For projects that have a working codebase alongside docs.
- **`knowledge_base/<slug>/docs/`** — entries with `"category": "kb"`. For doc-only entries (reference material describing systems that live elsewhere, e.g. network maps, inventories, runbooks).

Both are bind-mounted into homer at `/www/docs/<slug>/`, one mount per entry — only the path on the host side differs. Only the hub index and shared assets live in the skill.

**The registry is the source of truth.** `docs-registry.json` is what the hub reads at load to render cards — edit a file but skip the registry and the hub won't show it. Always update both. The hub renders entries in two sections (Projects first, Knowledge Base second), keyed off the `category` field.

**Back-link and footer are injected at runtime by `docs.js`** — every doc page just needs an empty `<a class="back-link"></a>` near the top and an empty `<footer class="doc-footer"></footer>` near the bottom of `<article class="doc">`. The script reads the current URL (`/docs/<slug>/<page>`), looks up the slug in the registry, and fills both:

- **Back-link**: index pages → `← All docs` to `/docs/`; non-index pages → `← <Project name>` to `/docs/<slug>/`.
- **Footer**: `<Project name> · project ↗ (if projectUrl) · index (if not on index) · all docs · dashboard`.

The doc template includes hardcoded fallback content for both so no-JS readers still get useful links. Don't hand-write footer nav in individual pages — leave the placeholders empty (or with the template fallback) and let JS handle it. The registry field `"projectUrl": "<url>"` is optional; include it for entries that have a live URL (deployed app, dashboard) and omit for pure reference docs.

**Themes are optional per-project token overrides.** A project entry can carry `"theme": "<slug>.css"`; when set, every doc page for that project loads `themes/<slug>.css` as a third stylesheet after `doc.css`, redefining colors and fonts on `:root`. Without a theme, the project inherits the default look. Themes should mostly stick to design tokens — layout and utility classes stay shared so the structure feels familiar across projects. See `themes/README.css` for the convention and an example skeleton.

## Four intents

The user invokes `/absol-docs` with one of the intents below. If which one is unclear, ask. Never run `docker compose up -d` yourself — mount changes need a container recreate; file edits inside an existing mount are live on refresh. Tell the user when a recreate is needed and let them run it.

## add — register a brand-new project

The entry lives at either `/mnt/nas/dev/projects/<slug>/` (code project) or `/mnt/nas/dev/knowledge_base/<slug>/` (doc-only). Pick the category first, since it decides the root directory and the bind-mount path.

If category is unclear, use **`AskUserQuestion`** — `project` for entries with a working codebase, `kb` for entries that are purely reference material describing something elsewhere. Default to `project` for ambiguous cases; pure-docs entries (no source folder, no build step) belong in `kb`.

Confirm the directory exists at the chosen root. If it doesn't, use **`AskUserQuestion`** for the correct path or slug — don't guess.

Ask the user for display name (default: slug title-cased), one-line description, and a Font Awesome icon class (default `fas fa-file-code` for project, `fas fa-book` for kb). Recommend defaults; don't grill.

Check `themes/`. If theme files exist beyond `README.css`, use **`AskUserQuestion`** to pick one, scaffold a new empty theme from the README skeleton, or stick with the default look. Surface this at scaffold time because applying a theme later means rewriting every page's `<link>` tags — cheaper to decide now.

If `<project>/docs/index.html` doesn't exist, copy the doc template into it and substitute `{{TITLE}}` / `{{PROJECT_NAME}}` / `{{SUBTITLE}}`. If a theme was chosen, insert this line after the `doc.css` link:

```html
<link rel="stylesheet" href="/docs/_assets/css/themes/<theme>.css">
```

Append the entry to the registry. `category` is required; include `"theme"` and `"projectUrl"` only if applicable:

```json
{
  "slug": "<slug>",
  "name": "<display name>",
  "icon": "<fa class>",
  "category": "project",
  "projectUrl": "http://aidev:PORT",
  "description": "<one-liner>",
  "theme": "<theme>.css",
  "docs": [{ "title": "Index", "path": "index.html" }]
}
```

`projectUrl` powers the footer's `project ↗` link. Include it for entries that have a live URL (deployed app, dashboard); omit for pure reference docs. If unsure, ask the user — homer's `config.yml` is the canonical source for project URLs.

Add a bind mount under the homer service's `volumes:` in `homer/docker-compose.yml`. Insert alongside the existing mounts in the matching block (Projects vs Knowledge base); preserve YAML indentation exactly.

- For `category: "project"`: `- ../<slug>/docs:/www/docs/<slug>:ro`
- For `category: "kb"`: `- ../../knowledge_base/<slug>/docs:/www/docs/<slug>:ro`

(Homer's compose lives at `projects/homer/`, so KB items need an extra `../` to climb out of `projects/` into the workspace root.)

Then tell the user: *"Mount added — run `docker compose up -d` in `homer/` to pick up the new volume."*

## page — add a doc page to a registered project

Verify the project is in the registry. If not, suggest `/absol-docs add <project>` first.

Derive a filename: lowercase the title, hyphenate, append `.html` (e.g. *"Build runbook"* → `build-runbook.html`). If the title is ambiguous, confirm via **`AskUserQuestion`**.

Resolve the entry's root from its `category` field — `projects/<slug>/docs/` for project, `knowledge_base/<slug>/docs/` for kb. Copy the doc template into `<root>/<slug>/docs/<filename>`, substitute placeholders. If the entry has a `theme` field, insert the same theme `<link>` line that already exists on its other pages — match exactly so the project stays visually consistent.

Append `{ "title": "<title>", "path": "<filename>" }` to the project's `docs:` list.

No docker recreate needed — mounted directories pick up new files live. The page is at `http://aidev:8080/docs/<project>/<filename>`.

## theme — assign, swap, or remove a project's theme

Verify the project is in the registry. If not, suggest `add` first.

List the available themes in `themes/` (skip `README.css`). If a theme name was supplied, validate it exists; if not, use **`AskUserQuestion`** to pick one, scaffold a fresh empty theme from the README skeleton, or remove the theme entirely.

Resolve the entry's root from its `category` (`projects/` or `knowledge_base/`). Update every `<root>/<slug>/docs/*.html`:

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

- User-invoked only — never auto-triggered by other absol skills. Hosted docs and pipeline state are separate concerns.
- Never run docker commands — tell the user when a recreate is needed; container state is theirs.
- Stay in the project's `docs/` and this skill's `assets/`; never touch `.absol/` pipeline files. New docs are self-contained HTML (no markdown).
- Themes redefine design tokens, not layout — broad rewrites that fight `doc.css` break the family resemblance across projects. (Scoped chrome keyed to a project-only class is fine.)
