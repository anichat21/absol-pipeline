---
name: absol-architect
description: On-demand architecture pass. Walks the codebase looking for shallow modules, broken seams, and untestable code; applies the deletion test; surfaces deepening candidates; reviews top tech-debt items; drafts ADRs for rejected candidates; for accepted candidates, writes a refactor PLAN-NNN entry to plan.md in the standard schema (seeds + execution tasks ready for the executor). Does not change code itself. Best run on opus — deletion-test analysis and ADR drafting benefit from opus's depth. Use when the user says '/absol-architect', 'architecture review', 'find refactoring opportunities', or asks to clean up tech debt structurally.
---

# absol-architect

> **Best on opus.** Deletion-test analysis, candidate evaluation, refactor decomposition, and ADR drafting all benefit from opus's depth. If you're on sonnet, tell the user once: *"This skill works best on opus — switch sessions before continuing?"* Then proceed regardless of their answer; don't gate.

Surface architectural friction, propose **deepening opportunities**, and produce executable refactor plans. User-invoked, not part of orchestrate. Does not modify code; accepted candidates land as a PLAN-NNN in `.absol/plan.md`, ready for the next pipeline run.

You are essentially the planner with a different intake: instead of consuming inbox/bugs notes, you derive your seeds from architectural analysis. Same output shape — a PLAN-NNN entry in `plan.md` following the standard schema.

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

`.absol/CONTEXT.md` (domain vocabulary — use verbatim), `.absol/adr/`, `.absol/tech-debt.md` (drives Step 4), `.absol/bugs.md`, `vision.md`, `roadmap.md`, `CLAUDE.md`, `state.md`.

**ADRs are precedent, not law.** Don't blindly re-suggest something an ADR decided against — but ADRs go stale. If one's premise no longer holds (the code, vision, or constraints moved past it), say so and offer to revisit it (`Reopen ADR-NNNN?` via the **`AskUserQuestion` tool**) rather than treating it as permanent. Logged decisions get re-examined, not obeyed forever.

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

- **New domain term named** → append to `.absol/CONTEXT.md` as `**Term** — definition. Use for X. Don't say Y.`
- **User rejects with a load-bearing reason** → offer an ADR per `.absol/adr/0000-template.md`. Skip ephemeral and self-evident reasons. Use the **`AskUserQuestion` tool** to confirm before drafting (`Draft ADR-NNNN?` → **Draft** / **Skip**), not plain text.

End the grilling loop with the **`AskUserQuestion` tool**:

- question: `Where does this candidate land?`
- header: `Candidate`
- options:
  - **Accept** — will go into the PLAN you write at Step 5.
  - **Reject (with reason)** — capture the load-bearing reason; if it's durable, offer ADR drafting.
  - **Park** — leave it; move on.

Loop back to Step 2 / Step 3 for additional candidates if the user wants more. When the user says they're done picking (or the candidate list is exhausted), proceed to Step 4.

## 4. Tech-debt review pass

Read `.absol/tech-debt.md`. Pick top 5 by priority (or as user requests). For each item, surface it inline (id, title, why it matters), then use the **`AskUserQuestion` tool**:

- question: `DEBT-{id} — {title}: how should this resolve?`
- header: `Tech debt`
- options:
  - **Add to PLAN** — include this DEBT note as a seed in the PLAN you write at Step 5. (No promotion happens until the PLAN is written.)
  - **ADR (accepted shape)** — draft an ADR documenting why it stays; remove the debt entry (the ADR is now the durable record).
  - **Park** — leave for now; revisit next architect run.

## 5. Persist accepted candidates as [note]s and write the PLAN

For every accepted item from Steps 3–4:

### 5a. Persist the candidate as a [note] in `.absol/tech-debt.md`

If the source was a tech-debt item already (Step 4 path), use its existing DEBT-NNN. Otherwise (Step 3 path) append a new `[note]` to `.absol/tech-debt.md`:

```
- [note]
  - id: DEBT-{next}
  - title: {short title in CONTEXT.md vocabulary}
  - description: {deepened shape summary — 1–2 sentences}
  - type: ARCH
  - priority: high | medium | low
  - subsystem: {area}
  - status: promoted
  - promoted_to: PLAN-{the one you're about to write}
```

Mark `status: promoted` and `promoted_to` immediately — these notes go straight into the new PLAN; they're not loose intake.

### 5b. Write a PLAN-NNN entry to `.absol/plan.md`

One PLAN per architect session. Append (preserving any existing plans), separated by `---`:

```
---

## PLAN-{next}: {global plan title — what this refactor accomplishes in <8 words}

- meta:
  - id: PLAN-{next}            ← check existing plan.md, increment
  - status: ready
  - created: YYYY-MM-DD
  - author: architect

### Summary

<2–3 sentences on what this refactor accomplishes architecturally. Reference the deletion-test reasoning and any ADRs that informed or were challenged by this work.>

### Seeds

- [seed]
  - id: DEBT-{next}            ← carried verbatim from the [note] you just wrote (or pre-existing)
  - title: {from note}
  - description: {from note}
  - type: ARCH
  - priority: {from note}
  - subsystem: {from note}
  - shaper_notes: |            ← architect's design constraints (see below)
      Deepened shape: <one-paragraph summary of the new module shape>
      Files involved: <list>
      Test strategy: <what new interface tests look like; what brittle internal tests get deleted>
      Out of scope: <anything ruled out during the grill>
      ADRs informing: ADR-NNNN  (omit if none)

- [seed]
  - id: DEBT-...               ← additional accepted items
  - …

### Execution

<vertical-slice refactor tasks — see "Decompose" below>

- [task]
  - id: TSK-{next}
  - title, description, subsystem, files_touched, dependencies,
    acceptance_criteria, verification, risk, executor_tier, execution_order
```

The `shaper_notes` block on each seed is the architect's equivalent of a /absol-shaper output — it captures the constraints you grilled out of the user. The planner uses shaper_notes during normal pipeline runs; the executor reads them during execution. Same field name, same purpose, different author.

### 5c. Decompose into vertical-slice tasks

Refactors are particularly tempting to slice horizontally ("first move all the code, then update all callers, then delete the old"). **Don't.** Each task must be a tracer bullet — one small piece of the refactor end-to-end-working before the next.

For each task, fill every field per the standard schema (see `~/.claude/skills/absol-orchestrate/references/schemas.md`):

- `files_touched`: be accurate. Refactors touch many files; predict carefully.
- `dependencies`: refactor tasks often depend on earlier slices landing first.
- `risk`: refactors are usually `medium` or `high` (touching shared code).
- `executor_tier`: usually `full` (refactors rarely qualify as `micro`).
- `execution_order`: by dependency — earlier slices land first.
- `description`: actionable — name the seams/functions and the order of operations so the executor doesn't re-derive the refactor. ARCH decisions are settled here (in the grill), not at runtime.
- `acceptance_criteria`: how to verify this slice works end-to-end (compiles, tests pass, behaviour preserved).

If a deepening candidate is too coarse to slice vertically (e.g. *"rewrite the auth module"*), break it into 3+ slices each delivering working incremental progress. Refuse to write a single mega-task.

## 6. Report

```
Architecture review — {project} ({date})

Candidates:    {n} surfaced — {n_accepted} accepted, {n_adr} ADR'd, {n_parked} parked
Tech-debt:     {n_reviewed} reviewed — {n_promoted} added to PLAN, {n_adr} ADR'd, {n_parked} left

PLAN written:  PLAN-{NNN} — {title}
  Seeds: {list of DEBT-NNN ids}
  Tasks: {n} total

CONTEXT.md:    {n} term(s) added/sharpened
ADRs drafted:  ADR-NNNN, ADR-MMMM           (omit if none)

Next: /absol on this project to run pipeline mode and execute PLAN-{NNN}.
```

## Ownership

- Only the architect writes ADRs. Other components can suggest the user run `/absol-architect`; they don't draft.
- Only the architect removes entries from `.absol/tech-debt.md` (via promotion or ADR; promotion happens by writing the [note] as `status: promoted` linked to the PLAN).
- The architect writes to `plan.md` directly — same output shape as `absol-planner`. Both are valid plan authors; the planner takes inbox-driven seeds, the architect takes architecture-derived seeds.
- Never modifies code. Refactor tasks land via the executor when pipeline runs.
- One PLAN per architect session. If multiple unrelated refactors come up, finish the session, run pipeline, then start a new architect session for the next PLAN.
