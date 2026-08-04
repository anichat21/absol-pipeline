# Opening a heavy ledger project immediately eats ~5% of context

- date: 2026-08-01 · project: huntrx · run: n/a
- component: front door

## What happened
`/absol huntrx` banner derivation cat'd state.md + all three intake files raw. huntrx's
inbox.md alone is ~16 KB with long-description items (INBOX-029's deploy punch list, INBOX-039's
idea pool), and state.md is another dense page — roughly 5% of the context window gone before
any work started, for a banner that only needs counts, IDs, titles and open:/smell lines.

## Expected
Owner: the ledger system needs an optimisation pass, and it needs a discussion, not a quick
patch. Candidate direction: banner derives from `absol-tool.mjs query` (filtered JSON — IDs,
titles, types, block-presence flags) instead of raw file reads, with full descriptions loaded
only for the items a session actually touches.
