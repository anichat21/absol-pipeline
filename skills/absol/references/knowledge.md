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

## Transition

The homer-mounted hub still serves entries until ArcticTern reaches parity (docs + tracker
+ links). absol-docs' registry editing and compose-mount machinery is legacy from that era —
don't extend it; it retires with homer.
