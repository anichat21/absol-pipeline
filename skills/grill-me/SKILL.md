---
name: grill-me
description: Interview the user relentlessly about a single idea, plan, or vague item until it's fully shaped. One question at a time, recommend an answer, explore the codebase instead of asking when possible. Output is appended to .absol/plan.md as a shaped plan-item. Best run on opus — deep interviews shape shallower on sonnet. Use when the user says '/grill-me', 'grill me on this', 'stress-test this plan', or asks to shape a vague item from the inbox.
---

# grill-me

> **Best on opus.** This skill walks the design tree depth-first across many branches with codebase exploration in between; sonnet shapes shallower. If you're on sonnet, tell the user once: *"This skill works best on opus — switch sessions before continuing?"* Then proceed regardless of their answer; don't gate.

Walk the design tree depth-first. One question at a time, with your recommended answer. Branch on the answer — the next question follows from this one. Read the codebase instead of asking when the answer is sitting in code.

End when the design is shaped enough for the planner: what to build, what it touches, layer-by-layer shape, what's out of scope, what tests verify it, any HITL decisions baked in. Don't keep grilling for grilling's sake.

## Read first

`.absol/CONTEXT.md` (use these terms verbatim), `.absol/adr/` (don't re-litigate; surface contradictions by number), `vision.md`, `roadmap.md`. If the source is an inbox entry at `status: needs-shaping`, capture its `INBOX-NNN`.

## Side effects (inline, as decisions crystallise)

- **New domain term named** → append to `.absol/CONTEXT.md` as `**Term** — definition. Use for X. Don't say Y.`
- **User rejects a direction with a load-bearing reason** → offer an ADR per `.absol/adr/0000-template.md`. Skip ephemeral reasons ("not worth it now") and self-evident ones; only offer when a future architect pass would otherwise re-suggest the same thing. Use the **`AskUserQuestion` tool** to confirm before drafting (`Draft ADR-NNNN?` → **Draft** / **Skip**), not plain text.

## Pre-approval pass (before output)

Once the design is shaped, run a sign-off pass on every step that would otherwise become a runtime HITL pause: anything you'd put under `hitl_hints`, plus schema/migration changes, destructive ops, public API surface, new external dependencies, breaking changes. The point is to front-load HITL into grill-me so orchestrate runs unattended.

For each decision, use the **`AskUserQuestion` tool**:

- question: one-sentence description of the decision
- header: `Pre-approve`
- options:
  - **Approve** — sign off now; orchestrate will execute without pausing.
  - **Defer** — keep it as a runtime HITL pause.
  - **Drop** — remove from the plan.

Record approved decisions verbatim under `pre_approved_decisions`. Deferred ones stay in `hitl_hints`. Dropped ones are omitted entirely. Set `pre_approved: full` if no `hitl_hints` remain, `partial` if some were deferred, `none` if every decision was deferred or there was nothing to approve.

## Output

Append one `[plan-item]` to `.absol/plan.md`:

```
- [plan-item]
  - id: PLAN-{next}
  - title: short title (CONTEXT.md vocabulary)
  - source: INBOX-NNN | user-typed | grill-me
  - shaped_at: YYYY-MM-DD
  - status: shaped
  - description: 2–4 sentences capturing the agreed shape
  - modules:
      - {ModuleName}: {what changes}
  - testing: what gets tested and what doesn't, in plain English
  - out_of_scope: what the planner must not pull in (omit if empty)
  - pre_approved: full | partial | none
  - pre_approved_decisions:            (omit if pre_approved: none)
      - {decision}: signed off YYYY-MM-DD
  - hitl_hints: decisions still expected to need HITL pause (omit if empty)
  - open_questions:                    (omit if empty)
      - {question}: {parking note}
```

If `source: INBOX-NNN`, also flip that inbox entry to `status: shaped` and add `shaped_into: PLAN-NNN`.

## Report

Two lines max — what got shaped, where it landed, and any side effects (CONTEXT term added, ADR drafted, inbox flipped).
