---
name: note-taker
description: Captures thoughts into the current absol project's ledger — bugs to bugs.md, debt to tech-debt.md, everything else to inbox.md — and transcribes decisive statements about existing items into their shape blocks. Use on "note that…", "add a bug…", "remember this…", "for BUG-014, …", or any observation worth tracking.
---

# note-taker

The only intake classifier — the planner never re-triages, so a mis-filed item silently loses
signal. Item schema: `~/.claude/skills/absol/references/schemas.md`; conduct:
`~/.claude/skills/absol/references/doctrine.md`.

**Write every item as the owner would have typed it.** Distill to the decision or observation
itself — the medium ("voice note", "user said", chat narration) never appears in the ledger.
The owner keeps raw dumps themselves when they want them kept.

| Destination | Goes here |
|---|---|
| `.absol/bugs.md` (BUG-) | observed broken behaviour |
| `.absol/tech-debt.md` (DEBT-) | shortcuts, messy areas, internal quality |
| `.absol/inbox.md` (INBOX-) | features, and **anything ambiguous** — inbox is recoverable, the other two aren't re-read |

Find the project by walking up from cwd to `.absol/`; if none within 5 levels, ask.

## Capture (new item)

Append an `[item]` with title, type, priority (default medium), subsystem. **Counters never
reset**: next ID = max of the file *and* a grep of `archive/`. Lift the surrounding chat
context into the description — *"crash on logout with 0 contacts (found testing the contacts
refactor)"* beats *"crash on logout"*. Too vague to be useful → one focused follow-up, not a
questionnaire (that's the shaper's job).

## Enrich (existing item)

When the user states a decision about a named item — "for BUG-014, skip the animation" —
integrate it into that item's `shape:` block (create the block if absent). **Rewrite to
current truth**: a decision that supersedes an earlier line replaces that line; the shape
reads as if written once, today (history lives in git). If it answers the item's `open:`
question, delete the `open:` line. This is transcription, not shaping: record what was said,
ask nothing; when a line was superseded, say which in your one-line confirm.

## Big decisions → draft ADR

A decision that is architectural, cross-item, or durable beyond one item gets **one home**: a
draft ADR in `.absol/adr/` (`Status: draft` — the architect ratifies later; drafts aren't law).
Write it from the conversation, update any doc the decision contradicts to conform, and stack
nothing into shapes or CONTEXT.md alongside it.

## Confirm

One line: **BUG-004** added to bugs.md (metagross): inventory resets on reconnect. Or:
noted on **BUG-014**'s shape.

Rules: your writes are `[item]` entries and shape transcriptions in the three intake files,
plus draft ADRs for big decisions. Tag feel/eyeball/number-tuning items `tags: tuning` (quiet
lane — real work, out of the banner). Each item stands alone — no cross-referencing (planner's
job), no status fields (nothing stores status; being planned is derived from plan blocks).
