# No deferred/parked tag in the tag vocabulary

- date: 2026-07-29 · project: arctic-tern · run: n/a
- component: note-taker / toolset

## What happened
Owner's feedback doc parked INBOX-026 ("defer for now ui is cluttered already") and asked:
"do we have a ddeffered/parked tag? if not we should". The toolset's `tag` verb only accepts
`rtr|tuning`, so the deferral had to be written as prose into the shape block — invisible to
banner counts and board filters, and indistinguishable from an ordinary shaped item.

## Expected
A `parked`/`deferred` tag as a third quiet lane: excluded from run-gate selection and banner
counts, visible as a chip so parked items don't look runnable.

## Resolved 2026-07-29 (same session, owner-directed)
Implemented directly: `parked` added to `TAGS` in tools/lib/parse.mjs, tag/untag help strings,
schemas.md tag doc + banner-exclusion rule, front-door SKILL.md banner counts + selection
exclusion, note-taker SKILL.md capture rule. Semantics: quiet lane, excluded from type-wide
run selections; only an explicit ID runs a parked item. First uses: arctic-tern INBOX-026/032/053.
