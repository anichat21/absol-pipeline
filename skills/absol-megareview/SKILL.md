---
name: absol-megareview
description: Deep unattended project review — fans out finders over the codebase for bugs, logic flaws, smells, dead code, and structural weaknesses, adversarially verifies findings, and writes a report artifact to .absol/reviews/ plus one ledger item pointing at it. Use on '/absol-megareview', 'mega review', or 'deep review the project'. Runs best on the most capable model available.
---

# absol-megareview

Whole-project adversarial review. Output: `.absol/reviews/{YYYY-MM-DD}-megareview.md` — verified
findings, structural analysis, and a proposal with a suggested order of work — plus **one**
INBOX item pointing at it. You change no code; findings become work only when the user runs
them. Counterpart: `absol-architect` decides interactively; you *find* and *propose*, and can
run headless/scheduled.

## Orient (cheap, before the fleet)

`.absol/CONTEXT.md`, `.absol/adr/` (an ADR-accepted trade-off is not a finding),
`CLAUDE.md`, `state.md`, the previous `.absol/reviews/` report if any (don't re-report what it
already found unless it got worse), and the project's verify command.

## The sweep (Workflow tool — this skill is your opt-in)

Dispatch one workflow: parallel finders → adversarial verify → synthesis. Constraints that are
not optional: **embed the file list / dimensions as literal consts** (Workflow `args` doesn't
reach the script here — workspace CLAUDE.md); every agent gets the read-hygiene rule (*check
size first; >256 KB → sample with `head`/`grep`/`jq`, never read whole*); finders are
read-only; **never run the project's build/tests uncapped** — aidev OOM-freezes (workspace
compute rules; use the project's capped commands only).

Finder dimensions — one agent each, scaled to repo size (split big repos by subsystem):

1. **Bugs & logic flaws** — off-by-state errors, broken invariants, unhandled paths that will
   fire.
2. **Dead & broken** — unreachable code, wired-but-never-rendered UI, exports nothing imports,
   config referencing nothing.
3. **Smells & overbuild** — copied logic drifting apart, sync hazards, shotgun-surgery
   clusters, needless abstraction: what a simpler construct or a deletion replaces (propose
   the delete-list).
4. **Structure** — deletion-test failures, shallow modules, seams that force lockstep edits
   (analysis + proposal, architect's lens).
5. **Docs-vs-code drift** — CLAUDE.md/CONTEXT.md/ADR claims the code no longer satisfies.

Then **verify before reporting**: every concrete finding (dims 1–3, 5) gets an independent
refuter agent — *"try to refute this; default to refuted if uncertain"*. Only survivors reach
the report. Structural findings (dim 4) get a judge for impact instead. Cap the fleet: finders
+ refuters ≤ ~20 agents unless the user asked for exhaustive.

## The report artifact

`.absol/reviews/{date}-megareview.md` — findings first, each with evidence (file/symbol, why
it's real, refuter verdict) and a severity; then structural analysis; then a **proposal**
section shaped like a review-to-work handoff: what to fix, simplest-fix-that-clears-the-bar
per finding, and a suggested order. Scannable — a future planner will read this as its map.

## The ledger pointer

Append one item to `.absol/inbox.md`:

```
- [item] INBOX-NNN
  - title: megareview {date} — {n} verified findings ({n} high)
  - type: ARCH · priority: by top severity · subsystem: cross-cutting
  - description: Report at .absol/reviews/{date}-megareview.md. Top: <three one-liners>.
```

The gate takes it from there — shaping selects which findings to act on; the report is the map.

Report back to the user in ≤5 lines: finding counts by severity, the top three, artifact path,
pointer item ID.
