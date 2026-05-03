---
name: grill-me
description: Interview the user relentlessly about a plan, idea, or design until you have a fully shaped item ready for the absol planner to consume. One question at a time, recommend an answer per question, explore the codebase instead of asking when possible. Output is appended to .absol/plan.md as a shaped item with modules / testing / out_of_scope sub-fields. Use when the user says '/grill-me', 'grill me on this', 'stress-test this plan', 'help me think through this idea', or asks to shape a vague item from the inbox.
---

# grill-me

Stand-alone shaper for a single idea, plan, or vague item. Where `absol-orchestrate`'s built-in shaper stays light (1–3 quick questions, then park), this skill goes deep — relentless interview until you've walked every branch of the decision tree.

The output is a fully shaped item appended to `.absol/plan.md`, ready for the next orchestrate run to plan and decompose into tasks.

## When to invoke

- The user explicitly typed `/grill-me` or said "grill me".
- The user is stress-testing a plan, exploring a design, or sketching a feature and wants pushback.
- The user pulled an item out of `.absol/inbox.md` that's parked at `status: needs-shaping` (the orchestrate shaper couldn't crack it within budget).

## Pre-flight

Identify the project root (`.absol/` layout assumed; fall back to flat layout for legacy projects). Read the following at the start of the session — once, not per question:

- `.absol/CONTEXT.md` (the domain glossary). Use these terms verbatim during the interview. If the user names a concept that isn't in CONTEXT.md, you'll add it as a side effect (see "Side effects").
- `.absol/adr/` (decision records). Don't re-litigate. If a candidate direction contradicts an existing ADR, surface that ADR by number and ask the user whether the friction is real enough to revisit it before continuing. Don't silently push the user toward something an ADR has already ruled out.
- `vision.md` and `roadmap.md` for product framing.
- The source of the item being grilled — either the user's prompt directly, or the inbox entry they referenced. If it's an inbox entry, capture its `id` (e.g. `INBOX-014`) — you'll flip its status at the end.

## Process

### 1. Interview

Walk the design tree depth-first. One question at a time. For each question:

1. **State the question** — single, specific, answerable.
2. **Recommend an answer** with one line of reasoning. Don't ask blank-slate questions; the user's job is to confirm, override, or redirect.
3. **Branch on the answer.** The next question follows from this one — explore consequences, dependencies, edge cases, the next decision the answer forces. Don't run a flat questionnaire; build the tree.

**Explore the codebase instead of asking when the answer is sitting in code.** Names, current behaviour, existing patterns, the shape of an existing module — these come from reading, not asking. Use the Agent tool with `subagent_type=Explore` for codebase walks. Reserve questions for things only the user knows: intent, priorities, domain definitions, whether a tradeoff is acceptable.

**Stay relentless but not infinite.** End the interview when:

- The user explicitly says "stop" / "we're done" / "ship it".
- You've covered: what to build, why, who/what it touches, the rough shape of each layer it cuts through, what's explicitly out of scope, what tests verify it, and any HITL decisions baked in.
- Returns are clearly diminishing — last 2 questions didn't change the design.

If you hit a question the user genuinely can't answer ("I don't know — let's see how it feels"), don't loop on it. Note it as a known unknown in the shaped item and move on.

### 2. Side effects (inline, as decisions crystallise)

While interviewing, if any of these happen, handle them inline — don't batch.

**A new domain term gets named or an existing fuzzy one gets sharpened.**
Add or update the entry in `.absol/CONTEXT.md`. Lazy growth — append to the Domain Terms section. Use the format:

```
**Term** — definition. Use for X. Don't say Y or Z.
```

Tell the user one line: `Added "Term" to CONTEXT.md.`

**The user rejects a direction with a load-bearing reason** (something a future architect skill or planner pass would re-suggest if it didn't know).
Offer an ADR. Frame it as: *"That's worth recording. Want me to draft this as an ADR so future passes don't re-suggest it?"* If yes, draft per `.absol/adr/0000-template.md`, propose a number (next free), and write only on confirmation. **Skip the offer for ephemeral reasons** ("not worth it right now") and **self-evident ones** — only offer when the rationale is genuinely durable and would be re-discovered otherwise.

**A concept the user names doesn't fit any existing term in CONTEXT.md but isn't yet sharp.**
Don't write a fuzzy entry. Park it as a question for later in the interview, then add only once it's clear.

### 3. Append to `.absol/plan.md`

Once the interview ends, write a single shaped `[plan-item]` entry. Append to the bottom of `.absol/plan.md`.

Schema:

```
- [plan-item]
  - id: PLAN-{nnn}        # next free; scan existing PLAN- IDs in plan.md
  - title: short descriptive title
  - source: INBOX-{nnn} | user-typed | grill-me
  - shaped_at: {date}
  - status: shaped
  - description: |
      2–4 sentences capturing the agreed shape.
      What this is, what behaviour it adds or changes, who or what it touches.
  - modules:
      - {ModuleName}: {what it owns / what changes}
      - {ModuleName}: {what it owns / what changes}
  - testing: |
      What gets tested and what doesn't, in plain English.
      e.g. "Cover the happy path through Cart.checkout end-to-end. Don't test the
      Stripe adapter directly — exercise it through the seam."
  - out_of_scope: |
      What the planner must not pull into the resulting tasks.
      Anything ruled out during the grill.
  - hitl_hints: |
      Any decisions or tasks the user expects to require human-in-the-loop pause
      (architecture choices, irreversible actions, design review). Plain English; the
      planner will translate into per-task hitl: yes flags.
  - open_questions:
      - {question}: {parking note}
```

Use the project's domain glossary terms in `description`, `modules`, `testing`, and `out_of_scope`. Don't drift.

If `out_of_scope` and `open_questions` are empty, omit them.

### 4. Flip the source inbox entry (if applicable)

If the source was `INBOX-{nnn}` with `status: needs-shaping`, edit `.absol/inbox.md`:

- Change that entry's `status` to `shaped`.
- Add a `shaped_into: PLAN-{nnn}` field referencing the new plan item.

This stops the inbox entry from sitting around forever waiting to be re-shaped, and gives the next orchestrate run a clear pointer to the plan entry it should consume instead.

If the source was the user typing in directly (no inbox entry), skip this step. Set `source: user-typed` on the plan item.

### 5. Final report

One short block, no narration:

```
Shaped: {title}
  → .absol/plan.md as PLAN-{nnn}
  → .absol/inbox.md INBOX-{nnn} flipped to status: shaped         (if applicable)
  → .absol/CONTEXT.md +{n} term(s)                                 (if applicable)
  → .absol/adr/{nnnn}-{slug}.md drafted                            (if applicable)

Open questions parked on the plan item: {count}.

Next: run /absol-orchestrate to plan and execute.
```

## What grill-me is NOT

- **Not a planner.** No `[task]` entries get written. Tasks come out of `absol-planner` consuming the shaped plan item on the next orchestrate run.
- **Not an executor.** No code changes. Reading the codebase is fine; writing it isn't.
- **Not a triage replacement.** If the user has multiple unrelated items, run `/absol-orchestrate` instead — that's what triage is for. Grill-me handles one item at a time.
- **Not the architect skill.** ADRs offered here are *user-confirmed records of a rejection during shaping*. Architectural deepening passes belong to `/absol-architect`.

## Rules

- **One question at a time.** Never ask three things in a row.
- **Always recommend an answer.** A blank-slate question is wasted breath.
- **Read before asking.** If the answer lives in code or in CONTEXT.md, look it up — don't make the user explain their own codebase to you.
- **Use CONTEXT.md vocabulary verbatim** in everything you write back to plan.md, inbox.md, ADRs, and CONTEXT.md itself.
- **Respect existing ADRs.** Surface contradictions; don't paper over them.
- **End-of-shape, not end-of-curiosity.** Stop when the design is shaped enough for the planner. Don't keep grilling for grilling's sake.
- **No silent file writes.** Every file you touch (CONTEXT.md addition, ADR draft, inbox flip, plan append) shows up in the final report.
