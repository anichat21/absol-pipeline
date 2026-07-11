# Tuning/feel-check tasks should be quiet by default — not narrated in the banner or full list

- date: 2026-07-05 · project: metagross · run: n/a (front-door triage)
- component: front door (banner) · note-taker/schema (item classification)

## What happened
Triaging a long inbox with the user, several items turned out to be "tuning tasks" they
didn't want surfaced every session — INBOX-079 (rivalry legibility), INBOX-080 (economy/
cadence), INBOX-064 (task-roster growth). The user: *"im thinking we need to set a rule to
keep quiet about tuning tasks or check the feel tasks. we should classify by page or
something bigger. is page ok? yes? everything is ok. if its not ok i will say so."* One item
(079) they killed outright as "tuning, remove and dont mention." The rest are real work but
should not be narrated by default. Interim handling: hand-tagged INBOX-064 and INBOX-080 with
`tags: tuning` — but nothing in the banner/list logic acts on that tag yet.

## Expected
A `tuning` (feel/eyeball/number-tuning) class on ledger items that stays real work but is
suppressed from the derived banner and default list output — shown only on explicit request
or a dedicated tuning view. Same treatment for owed feel-check/smoke items so they don't rot
in the banner. Open question: "classify by page" was ambiguous — pin down the grouping unit
(a `tuning` tag on individual items vs. bucketing many small items under one bigger umbrella).
