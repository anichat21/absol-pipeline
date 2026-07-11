# Shape refuse-clause treated as source of truth over live user intent

- date: 2026-07-11 · project: zei · run: RUN-2026-07-10-6
- component: shaper + orchestrator (front-door behaviour after smoke)

## What happened
INBOX-032's shape carried "commits to a destination that wasn't explicitly created inline
are refused, never silently auto-created." The build implemented it literally: a free-text
subfolder field that 409s on non-existent names, plus a second inline "New subfolder name"
+ Add/Cancel row — two look-alike inputs, no apparent save. When the user hit this trap on
prod (typed "Metal" expecting it to be created, stalled), the assistant *explained the rule
back to the user* — "commits never silently create folders, by design" — and proposed a
redesign that still preserved the refusal, instead of hearing the obvious intent: typing a
subfolder name should just work.

## Expected
Shape/refuse blocks are advisories that bind unattended runs; the moment the user pushes
back live, intent wins and the rule gets rewritten — no defending shipped behaviour by
citing the ledger. "If I tell you to make the square red, make it red."
