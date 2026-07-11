# Assistant kept re-surfacing the user's own write-access rule through a design flip-flop, amplifying confusion instead of absorbing it

- date: 2026-07-08 · project: zei · run: RUN-2026-07-08 (scratchpad) + post-run capture
- component: front door / note-taker capture behaviour (conversation routing, not a pipeline agent)

## What happened
The read-only-Resources rule (user's own, in zei CLAUDE.md) got quoted back at the user at
every turn of a same-day design oscillation: (1) morning — user grants write access + makes
Zei the physical organiser; assistant rewrites CLAUDE.md/CONTEXT.md/INBOX-005 to match.
(2) evening — user brain-dumps a virtual pointer-only Library (INBOX-008); assistant frames
it as a "conflict with this morning's decision" and asks the user to arbitrate. (3) user
says "revert, prev design is better" — ambiguous; assistant guesses *virtual* and starts
rewriting truth files again. (4) user interrupts: "revert to the old system, serve as-is";
assistant scrubs everything back to the original read-only contract. (5) user: "I fucked up,
the morning one is what I want" — third full rewrite of the same three files in one day.
User's closing verdict: "stop fighting me with my own rules man."

## Expected
Decisive statements from the owner supersede prior rules silently — transcribe the newest
truth, don't re-present superseded constraints as blockers/conflicts the user must resolve.
When a revert is ambiguous between three design states, ask ONE disambiguating question
("revert to which: morning-organiser or original read-only?") before rewriting any truth
files, instead of guessing and churning CLAUDE.md/CONTEXT.md/ledger repeatedly.
