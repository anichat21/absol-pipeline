---
name: absol-architect
description: On-demand architecture pass over the current absol project. Walks the codebase looking for shallow modules, broken seams, and untestable code; applies the deletion test; surfaces deepening candidates; reviews top tech-debt items; drafts ADRs for rejected candidates. Writes accepted candidates back to .absol/inbox.md as type ARCH for the next orchestrate run to plan and execute. Does not change code itself. Use when the user says '/absol-architect', 'architecture review', 'find refactoring opportunities', 'review the codebase architecture', or asks to clean up tech debt structurally. Not part of the orchestrate pipeline — user-invoked, cadence is up to them.
---

# absol-architect

Surface architectural friction in the project and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability, locality, and AI-navigability.

This skill runs on demand. It is **not** part of `absol-orchestrate`. Suggested cadence: after a major feature ships, or when something feels off architecturally.

The skill does **not** modify code. Accepted candidates go back into `.absol/inbox.md` as `type: ARCH` items; the next orchestrate run plans and executes them.

## Glossary (use these terms verbatim)

Borrowed from mattpocock's `improve-codebase-architecture`. Use these names everywhere you write or speak — don't drift into "component," "service," "API," "boundary."

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface: a lot of behaviour behind a small interface. **Deep** = high leverage. **Shallow** = interface nearly as complex as the implementation.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place. (Use this, not "boundary.")
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place.

Three principles that run the whole skill:

- **Deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module is the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless something actually varies across it.

## Pre-flight

Identify the project root (`.absol/` layout assumed; fall back to flat layout for legacy projects). Read once, before exploring:

- `.absol/CONTEXT.md` — domain glossary. Use these terms verbatim when naming modules and describing candidates. *"The Order intake module"*, not *"the FooBarHandler"*, not *"the order service"*.
- `.absol/adr/` — every existing ADR. Don't re-suggest things that have already been decided. ADR-0007 saying "we chose Zustand not Redux" means the architect doesn't keep proposing Redux.
- `.absol/tech-debt.md` — the durable debt log. Drives the debt-review pass in Step 4.
- `.absol/bugs.md` — useful context (some bugs are symptoms of shallow architecture).
- `vision.md`, `roadmap.md`, `CLAUDE.md` — product framing, stack, constraints.

If `CONTEXT.md` is empty or missing, that's expected on a young project. You'll seed terms as you go (see Side effects).

If the project is on the legacy flat layout, fall back to root-level paths and surface a one-line note in your final report recommending `/absol-migrate`.

## Process

### 1. Explore

Use the Agent tool with `subagent_type=Explore` to walk the codebase. Don't follow a rigid heuristic checklist — explore organically and note where you experience friction:

- Where does understanding one concept require bouncing between many small modules?
- Where are modules **shallow** — interface nearly as complex as the implementation? (Pass-through wrappers, getter/setter classes that own no invariants, manager files that just dispatch to other manager files.)
- Where have pure functions been extracted "for testability" but the real bugs hide in *how* they're called (no **locality**)?
- Where do tightly-coupled modules leak across their seams — types defined in one module mutated by another, lifecycle assumptions threaded through call chains?
- Which parts of the codebase are untested or hard to test through their current interface?
- Where does a single change require touching 4+ files in lockstep? (Strong signal of a missing deep module.)

Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" — the complexity reappears across N callers — is the signal you want.

Spend roughly an order of magnitude more effort here than on writeup. Reading is the work.

### 2. Present candidates

Surface a numbered list of deepening opportunities. For each candidate:

```
{N}. {Domain-noun} {what} — {one-line headline}

  Files:    {paths involved}
  Problem:  {why the current architecture is causing friction; reference the
             deletion test where it applies — "Deleting X just spreads
             complexity to A/B/C, not concentrates it"}
  Solution: {plain-English description of the deepened shape — the new module's
             interface, what sits behind the seam, what gets deleted as part of
             the move}
  Benefits: {locality and leverage gains, plus how tests improve — what tests
             you can write at the new interface, what brittle internal tests
             go away}
  Risk:     low | medium | high   (for planner consumption)
  ADR check: {none} | {contradicts ADR-NNNN — and whether you think it's worth reopening}
```

Use **CONTEXT.md vocabulary for the domain** and **the architectural glossary for the architecture**. If CONTEXT.md defines `Order`, write *"the Order intake module"* — not *"the FooBarHandler"*, not *"the order service"*.

**ADR conflicts.** If a candidate contradicts an existing ADR, surface it only when the friction is real enough to warrant reopening the ADR. Mark it clearly: *"Contradicts ADR-0007 — but worth reopening because the constraint that drove ADR-0007 has changed, namely X."* Don't list every theoretical refactor an ADR forbids.

Do **not** propose interfaces in detail yet. Ask the user: *"Which of these would you like to explore?"*

### 3. Grilling loop (per candidate the user picks)

When the user picks a candidate, drop into a focused conversation. Walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects happen inline as decisions crystallise:

- **Naming a deepened module after a concept not in CONTEXT.md** → add the term inline. Format: `**Term** — definition. Use for X. Don't say Y or Z.` Tell the user: *"Added 'OrderIntake' to CONTEXT.md."*
- **Sharpening a fuzzy term during the conversation** → update CONTEXT.md right there.
- **The user rejects the candidate with a load-bearing reason** → offer an ADR. Frame it: *"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"* **Only the architect skill drafts ADRs.** Skip the offer for ephemeral reasons ("not worth it right now") and self-evident ones — only offer when the rationale would actually be re-discovered. Use `.absol/adr/0000-template.md` as the shape; pick the next free number.
- **Want to explore alternative interfaces for the deepened module** → walk through the alternatives one at a time. Evaluate each on: depth (does it concentrate behaviour?), test surface (can you cover behaviour through the interface alone?), and adapter discipline (one adapter = hypothetical seam; introduce a port only if at least two adapters are real).

The grilling loop ends when one of three things happens:

- The user accepts the candidate → write it to inbox (Step 5).
- The user rejects the candidate with a load-bearing reason → ADR drafted (this is itself an output).
- The user defers ("park it for now") → no inbox write, no ADR. Move on to the next candidate.

### 4. Tech-debt review pass

After (or interleaved with) the deepening pass, do a **debt-review pass**.

Read `.absol/tech-debt.md`. Pick the top N items by priority (default: top 5; user can ask for more). For each, ask: is this debt that converts into a real task, or is it accepted shape?

Three outcomes per item:

- **Promote** — debt is real and actionable. Surface it as a candidate the same way as a deepening opportunity (Step 2 schema). On user approval, write it back to `.absol/inbox.md` as a `type: ARCH` (or `CHORE` / `BUG` if more appropriate) item with `status: new`. Mark the original debt entry with `promoted_to: INBOX-{nnn}` so it's traceable, and remove the debt entry — once promoted, the file shouldn't double-count it.
- **Accept** — the debt is the right shape; we're choosing to live with it. Offer an ADR documenting why. On user approval, draft the ADR per Step 3 rules. Then remove the debt entry from `tech-debt.md` (the ADR is now the durable record).
- **Park** — neither obviously promotable nor obviously acceptable. Leave the debt entry alone. Move on.

The debt-review pass closes the loop on tech-debt: items either become tasks or become decisions. They don't sit in the file forever, accreting.

### 5. Write accepted candidates back to inbox

For every candidate the user accepted (deepening or debt-promotion), append a `[note]` entry to `.absol/inbox.md`:

```
- [note]
  - id: INBOX-{nnn}                # next free
  - title: short descriptive title using CONTEXT.md vocabulary
  - description: |
      The deepened shape we agreed on, plain English.
      Reference the deletion-test reasoning if it's load-bearing.
  - type: ARCH                     # or CHORE / BUG when promoting debt
  - priority: high | medium | low
  - subsystem: {area}
  - status: new
  - source: absol-architect        # optional — handy for future audits
  - notes: |                       # optional — long-form notes the planner should see
      Files involved: {list}
      Test strategy: {one or two lines on what the new interface tests look like
        — replaces brittle internal tests on the old shallow modules}
      Out of scope: {anything explicitly ruled out during the grill}
```

The next orchestrate run will planner-consume the entry and decompose it into tasks. The architect skill itself **never writes tasks** — that's the planner's job.

If the candidate was a debt-promotion, also edit `.absol/tech-debt.md` to remove the source entry (or annotate it with `promoted_to: INBOX-{nnn}` if you want a paper trail before deleting on the next pass — pick one approach per project and stick with it; default: remove cleanly to avoid duplication).

### 6. Final report

```
Architecture review — {project} ({date})

Candidates surfaced:        {N}
  Accepted → inbox:          {n}    [INBOX-... ids]
  Rejected → ADR drafted:    {n}    [ADR-... numbers]
  Parked / deferred:         {n}

Tech-debt items reviewed:   {N}
  Promoted to inbox:         {n}    [INBOX-... ids]
  ADR'd as accepted shape:   {n}    [ADR-... numbers]
  Left in place:             {n}

CONTEXT.md updates:         {n} term(s) added or sharpened.

Next: run /absol-orchestrate to plan and execute the new ARCH items.
```

If the project is on the legacy flat layout, append: *"Layout: flat (legacy). Run `/absol-migrate` to upgrade."*

## What absol-architect is NOT

- **Not a code-changer.** No edits to `.ts` / `.py` / `.css`. Reading is fine; writing isn't. Refactors land via the planner + executor on the next orchestrate run.
- **Not the planner.** No `[task]` entries get written. Inbox `type: ARCH` is the contract.
- **Not the grill-me skill.** Grill-me shapes one item the user is already thinking about. Architect *finds* candidates the user hadn't surfaced yet.
- **Not auto-triggered.** Cadence is the user's call. The pipeline never spawns the architect.

## Rules

- **Use CONTEXT.md vocabulary verbatim.** This is the highest-leverage consistency lever.
- **Apply the deletion test before calling something shallow.** If complexity merely *moves* on deletion, the module was load-bearing — don't propose deepening it.
- **One adapter ≠ a real seam.** Don't propose a port unless at least two adapters justify it.
- **Surface ADR conflicts; don't ignore them.** And only reopen an ADR when the constraint that drove it has changed.
- **Architect owns the ADR write path.** Other skills (planner, note-taker, grill-me) don't write ADRs. They can suggest the user run architect to draft one.
- **Architect owns debt cleanup.** Tech-debt entries leave `tech-debt.md` only via this skill (promoted to inbox) or via an ADR drafted here (accepted shape). The finalizer doesn't touch them.
- **Never propose an interface in Step 2.** Interface design happens during the grill, when the user is in the loop.
- **Replace, don't layer, the test strategy.** When deepening, old unit tests on the shallow pieces become waste — name them as part of the candidate's "what gets deleted" list.
