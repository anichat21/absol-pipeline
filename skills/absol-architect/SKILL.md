---
name: absol-architect
description: On-demand architecture pass. Walks the codebase looking for shallow modules, broken seams, and untestable code; applies the deletion test; surfaces deepening candidates; reviews top tech-debt items; drafts ADRs for rejected candidates. Writes accepted candidates to .absol/inbox.md as type ARCH for the next orchestrate run. Does not change code itself. Best run on opus — deletion-test analysis and ADR drafting benefit from opus's depth. Use when the user says '/absol-architect', 'architecture review', 'find refactoring opportunities', or asks to clean up tech debt structurally.
---

# absol-architect

> **Best on opus.** Deletion-test analysis, candidate evaluation, and ADR drafting all benefit from opus's depth. If you're on sonnet, tell the user once: *"This skill works best on opus — switch sessions before continuing?"* Then proceed regardless of their answer; don't gate.

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. User-invoked, not part of orchestrate. Does not modify code; accepted candidates go back to `.absol/inbox.md` as `type: ARCH`.

## Glossary (use verbatim)

- **Module** — anything with an interface and an implementation.
- **Interface** — everything a caller must know: types, invariants, error modes, ordering, config. Not just the type signature.
- **Depth** — leverage at the interface. Deep = lots of behaviour behind a small interface. Shallow = interface nearly as complex as the implementation.
- **Seam** — where an interface lives. (Not "boundary".)
- **Adapter** — concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth. **Locality** — what maintainers get.

Three principles:

- **Deletion test.** Imagine deleting the module. Complexity vanishes → it was a pass-through. Complexity reappears across N callers → it was earning its keep.
- **The interface is the test surface.** If you want to test past the interface, the module is the wrong shape.
- **One adapter = hypothetical seam. Two adapters = real one.** Don't introduce a port unless something actually varies across it.

## Read first

`.absol/CONTEXT.md` (domain vocabulary — use verbatim), `.absol/adr/` (don't re-suggest decided-against things), `.absol/tech-debt.md` (drives Step 3), `.absol/bugs.md`, `vision.md`, `roadmap.md`, `CLAUDE.md`.

## 1. Explore

Use the Agent tool with `subagent_type=Explore` to walk the codebase. Look for shallow modules, leaky seams, untestable interfaces, places where a single change touches 4+ files in lockstep. Apply the deletion test before calling something shallow.

## 2. Present candidates

Numbered list. For each:

```
{N}. {Domain-noun} {what} — headline
  Files:    {paths}
  Problem:  {friction; deletion-test reasoning if load-bearing}
  Solution: {deepened shape, plain English}
  Benefits: {locality, leverage, test improvements}
  Risk:     low | medium | high
  ADR check: none | contradicts ADR-NNNN — worth reopening because {reason}
```

Use CONTEXT.md vocabulary for the domain, the glossary above for architecture. Surface ADR conflicts only when worth reopening — don't enumerate every theoretical refactor an ADR forbids. Don't propose interface details yet.

Then use the **`AskUserQuestion` tool** (not plain text) to pick the next candidate. If the candidate list has ≤4 entries, present them as labelled options directly. If >4, group into 3 options (e.g. *"Top 3"*, *"Tech-debt-related"*, *"Pick by number"*) and use the tool's automatic "Other" free-text for arbitrary picks.

## 3. Grill the picked candidate

Walk the design tree with the user — constraints, dependencies, the deepened shape, what sits behind the seam, what tests survive. Inline side effects:

- New domain term named → append to `.absol/CONTEXT.md`.
- User rejects with a load-bearing reason → offer an ADR per `.absol/adr/0000-template.md`. Skip ephemeral and self-evident reasons. Use the **`AskUserQuestion` tool** to confirm before drafting (`Draft ADR-NNNN?` → **Draft** / **Skip**).

End the grilling loop with the **`AskUserQuestion` tool**:

- question: `Where does this candidate land?`
- header: `Candidate`
- options:
  - **Accept** — write to `.absol/inbox.md` as `type: ARCH` (Step 5).
  - **Reject (with reason)** — capture the load-bearing reason; if it's durable, offer ADR drafting.
  - **Park** — leave it; move on.

## 4. Tech-debt review pass

Read `.absol/tech-debt.md`. Pick top 5 by priority (or as user requests). For each item, surface it inline (id, title, why it matters), then use the **`AskUserQuestion` tool**:

- question: `DEBT-{id} — {title}: how should this resolve?`
- header: `Tech debt`
- options:
  - **Promote** — write to `.absol/inbox.md` as `type: ARCH` (or CHORE/BUG); remove the source debt entry.
  - **ADR (accepted shape)** — draft an ADR documenting why it stays; remove the debt entry (the ADR is now the durable record).
  - **Park** — leave it for now; revisit next architect run.

## 5. Write accepted candidates to inbox

For each accepted candidate (deepening or debt-promotion), append to `.absol/inbox.md`:

```
- [note]
  - id: INBOX-{next}
  - title: title in CONTEXT.md vocabulary
  - description: deepened shape, deletion-test reasoning if load-bearing
  - type: ARCH | CHORE | BUG
  - priority: high | medium | low
  - subsystem: {area}
  - status: new
  - source: absol-architect
  - notes: |
      Files: {list}
      Test strategy: {what the new interface tests look like; what brittle internal tests get deleted}
      Out of scope: {anything ruled out during the grill}
```

The next orchestrate run plans and executes. The architect never writes tasks.

## 6. Report

```
Architecture review — {project} ({date})

Candidates:    {n} surfaced — {n} accepted, {n} ADR'd, {n} parked
Tech-debt:     {n} reviewed — {n} promoted, {n} ADR'd, {n} left
CONTEXT.md:    {n} term(s) added/sharpened

Next: /absol-orchestrate
```

## Ownership

- Only the architect writes ADRs. Other components can suggest the user run `/absol-architect`; they don't draft.
- Only the architect removes entries from `.absol/tech-debt.md` (via promotion or ADR).
- Never modifies code. Refactors land via the planner + executor.
