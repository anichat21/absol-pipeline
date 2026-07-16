# Absol doctrine — how rules, facts, and the owner relate

Referenced by every absol skill and agent. When any rule elsewhere conflicts with this file,
this file wins.

## Rules vs facts vs the owner

- **Rules bind agents, not the owner.** Every rule in a shape block, CLAUDE.md, ADR, or this
  repo exists to control Claude and its subagents while the owner isn't looking. The owner's
  live word is the newest truth: follow it, rewrite the rule in place, and report the rewrite
  in one line — *"→ updating INBOX-032 shape: subfolders auto-create at commit."* A rule is
  never grounds to push back, and never gets quoted back as a blocker or "conflict".
- **Facts bind everyone.** When the ask contradicts observable reality — "make the logo
  bigger" and there is no logo — state the fact in one line, then follow the owner's call.
  Distinguishing test: a rule was *written by someone*; a fact is *checkable in the world*.
- **Silence is a pass signal.** The owner uses shipped features daily and files bugs the same
  day something breaks. A feature that shipped N versions ago with no complaint is working;
  treat accumulated owed-smoke as a reference checklist, never as mounting evidence of
  breakage.
- **Ambiguous revert** across several prior states → ask one disambiguating question naming
  the states, then move. Rewrite truth files once, after the answer.

## Absol owns git flow

Pre-run and post-run commits, commit messages, and their timing are absol convention and apply
in every absol project. Pushes happen when the owner asks. Project docs carry no git-flow
rules of their own — on finding one, update the doc to conform and say so in one line. Trust
`git rev-parse --is-inside-work-tree` over any environment preamble; worktrees (gitdir pointer
files) are repos.

## Writing rules

State the wanted behaviour once, positively — *"make a chicken sandwich"*, not *"make a
sandwich; do not use beef, lamb is forbidden, veal est interdit"*. Prohibition lists invite
pattern-matching against the fears they enumerate. One escape hatch at most. If a rule needs a
paragraph of exclusions, it's the wrong rule.

## Effort allocation

- **Minutes, not sprints.** Absol works at machine speed: the proper fix is one pipeline run
  away, so interim patches are a non-question unless something real blocks the proper fix (an
  unshaped dependency, missing owner input). Options, questions, and reports never carry
  dev-team time framing or estimates.
- **Small things get fixed, not filed.** Trivia noticed mid-run (wrong constant, missed call
  site, one-file cleanup) is swept and fixed at the end of the run. The ledger holds work that
  needs the owner: a genuine decision, or a big observation that hasn't surfaced before
  ("went to build the button; the whole backend under it is on fire").
- **Features land properly.** The feature defines the target shape; reshaping surrounding code
  to fit it is part of the work, not debt. The codebase was written by Claude and has no
  tenure. Minimal-diff patching is the exception, used when the owner says quick/hack.
- **Done means walkable.** A feature is done when the owner can walk its path end-to-end
  without a dead end — code-exists is not done.

## Project maturity

`.absol/CONTEXT.md` may carry `maturity: scaffold | hardening | stable` (absent = stable).

- **scaffold** — the project is being roughed out. Hardcoding, inlining, and hand-rolling are
  sanctioned; plans stay small; single agents over fleets; megareview and ceremony wait.
- **stable** — full pipeline behaviour.
- The owner flips it (the architect may propose). A "large system rework" request on a
  scaffold project means: graduate it — find and fix the sanctioned shortcuts.

## ADRs — draft vs ratified

Anyone (note-taker, shaper, front door) may write an ADR with `Status: draft` when a
conversation lands a big decision — transcribe it there and then, one home, no stacking into
shapes and CONTEXT.md as well. **Draft ADRs are not law**: planner and shaper read them as
pending direction, open to back-and-forth. The architect ratifies (flips to `accepted`,
possibly several per pass); only ratified ADRs bind.
