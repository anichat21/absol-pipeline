# Knowledge rules — the knowledge_base convention

Structure is law; inside the page, creativity is. Rules bind authors (human and LLM alike);
the reader is who they serve.

## The rules

1. **One entry = `knowledge_base/<slug>/`** — lowercase-hyphenated slug, `docs/` for what the
   entry publishes, optional `references/` for what it consumes. Nothing loose in the
   knowledge_base root.
2. **Every entry has a front door**: `docs/index.html` or `docs/index.md`.
3. **Discovery, not registration.** ArcticTern lists what exists on disk; a page's `<title>`
   (or a markdown file's first `#` heading) is its display name. There is no registry to
   maintain — the legacy `docs-registry.json` is now generated from the filesystem.
4. **Pages are self-contained** or use only the shared assets at `/docs/_assets/`. No
   external CDNs, no cross-entry asset imports.
5. **Two formats, both legal.** `.html` for designed pages — full creative freedom: themes,
   mermaid, imagery, layout. `.md` for quick notes — ArcticTern renders them with standard
   chrome. Starting a note as md and upgrading it to a designed html page later is the
   normal life cycle, not rework.
6. **Favor visuals over text walls.** A diagram, a table, a callout, a screenshot — the
   reader's eyes reach these before prose. This is a style expectation, not a format rule:
   how a page achieves it is the author's business.
7. **Workspace doc rules apply inside**: rewrite to current truth, no notes on notes,
   concise and clean.

## Production

Homer was sunset 2026-07-27; ArcticTern has been the production face since, discovering
entries from the filesystem. The shared assets behind `/docs/_assets/` (css/js/templates,
per-project themes) are served from `projects/absol/skills/absol-docs/assets/` — a legacy
path ArcticTern's server.mjs pins; the absol-docs skill itself is retired. Theme swap = point
the page at a different `css/themes/*.css` there.
