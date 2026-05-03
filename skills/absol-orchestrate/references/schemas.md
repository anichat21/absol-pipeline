# Absol Workflow Schemas

All markdown data files use these compact, machine-readable schemas. Each item is a markdown list block with stable field names. Avoid prose — keep entries scannable.

All paths assume the `.absol/` layout. Legacy flat-layout projects use root-level paths until migrated.

---

## `.absol/inbox.md` — `[item]` and `[note]`

`[item]` entries come from the planner's triage step (incoming requests routed in). `[note]` entries come from `note-taker`, `/grill-me`, or the user.

```
- [item]
  - id: INBOX-001
  - title: short descriptive title
  - raw_request: original request text (verbatim or lightly cleaned)
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area
  - route: inbox | plan
  - batchable: yes | no
  - needs_arch_review: yes | no
  - status: new | needs-shaping | shaped | promoted | rejected
  - shaped_into: PLAN-NNN          (optional, set when /grill-me shapes the item)
  - parking_note: …                (optional, set when shaper parks the item)
```

The `[note]` schema is identical to the bugs.md / tech-debt.md note (see below) — note-taker uses the same shape across all three router destinations.

---

## `.absol/plan.md` — `[plan-item]`

```
- [plan-item]
  - id: PLAN-001
  - title: short descriptive title
  - source: INBOX-NNN | user-typed | grill-me
  - shaped_at: YYYY-MM-DD
  - status: new | shaping | shaped | ready | blocked | promoted | done
  - description: |
      What this is, what behaviour it adds or changes, who/what it touches.
  - modules:                                # optional — PRD fold-in
      - {ModuleName}: {what it owns / what changes}
  - testing: |                              # optional — PRD fold-in
      What gets tested and what doesn't.
  - out_of_scope: |                         # optional — PRD fold-in
      What the planner must not pull in.
  - hitl_hints: |                           # optional
      Decisions or tasks expected to require HITL pause.
  - open_questions:                         # optional
      - {question}: {parking note}
  # Legacy fields (kept for back-compat with old plan.md files):
  - problem: …
  - proposed_direction: …
  - integration_notes: …
  - prerequisites: …
  - risks: …
```

The PRD-style fields (`modules`, `testing`, `out_of_scope`) are populated by `/grill-me` for shaped items, and consumed by the planner during decomposition. The legacy fields stay supported for items written by older orchestrate runs.

---

## `.absol/todo.md` — `[task]`

```
- [task]
  - id: TSK-001
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - title: short descriptive title (use CONTEXT.md vocabulary)
  - description: what to do (concrete, references files/functions/modules by name — no line numbers)
  - subsystem: affected area
  - dependencies: TSK-xxx, TSK-yyy   (or: none)
  - acceptance_criteria: how to verify the slice is demoable end-to-end
  - verification: command or check to run
  - risk: low | medium | high
  - hitl: yes | no
  - executor_tier: micro | full
  - execution_order: 1-indexed integer (unique, no gaps)
  - status: pending | in-progress | done | failed | blocked
```

**`hitl`** — `yes` pauses the orchestrator before this task and surfaces it to the user for free-form input (approve / reject / amend / pivot). `no` runs unattended. The planner clusters HITL tasks together (start of run preferred, end if dependencies force it) and never interleaves them with AFK tasks.

**`executor_tier`** — `micro` runs inline in the orchestrator (no agent spawn). `full` spawns the executor agent. The planner picks the tier; the orchestrator trusts it.

**Vertical-slice rule** — every task is a tracer bullet through every layer it touches. Pure horizontal tasks (all-schemas-first, all-APIs-second) are forbidden.

---

## `.absol/todo-run.md` — `[job]`

```
- [job]
  - run_id: RUN-2026-05-03
  - task_id: TSK-001
  - status: running | done | failed | blocked | needs-review
  - worker: sonnet | opus | inline
  - files_touched: path/a.ts, path/b.ts
  - summary: one-line description of what was done
  - verification_result: pass | fail | skipped
  - blocker: description of blocker (or: none)
  - review_flag: yes | no
```

`worker: inline` means the orchestrator ran a `executor_tier: micro` task directly without spawning an agent.

---

## Review output — `[review]`

```
- [review]
  - task_id: TSK-001
  - reviewer: sonnet | opus
  - verdict: approved | fix-required | blocked | human-check
  - evidence: what was checked (specific files, modules, test results)
  - issues: list of problems found (or: none)
  - fix_request: what needs to change (or: n/a)
  - human_check: yes | no
```

---

## `.absol/bugs.md` and `.absol/tech-debt.md` — `[note]`

Same shape used by `note-taker`'s router and architect promotions:

```
- [note]
  - id: BUG-001  | DEBT-001
  - title: short descriptive title
  - description: 1–2 sentences
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area
  - status: new | promoted | resolved
  - promoted_to: INBOX-NNN          (optional, when architect promotes a debt item)
```

---

## ID Conventions

| Prefix | Source |
|---|---|
| `INBOX-` | `.absol/inbox.md` items and notes |
| `PLAN-` | `.absol/plan.md` items |
| `TSK-` | `.absol/todo.md` tasks |
| `BUG-` | `.absol/bugs.md` notes |
| `DEBT-` | `.absol/tech-debt.md` notes |
| `RUN-` | Pipeline invocation run IDs |
| `ADR-` | `.absol/adr/` decision records (file names: `NNNN-short-slug.md`) |

IDs are monotonically increasing within each file. When promoting items between files (inbox → plan → todo, debt → inbox), create a new ID in the target and reference the source ID via `source` / `promoted_to`.

---

## Task Classes

| Class | Use for |
|---|---|
| ARCH | Architectural changes, refactors that alter system structure |
| FEATURE | New user-facing functionality |
| BUG | Broken behaviour that needs fixing |
| TWEAK | Small improvements to existing behaviour |
| CHORE | Maintenance, deps, config, docs, cleanup |

---

## Status lifecycles

**`[item]` in inbox.md:**
`new` → (shaper / grill-me) → `needs-shaping` → (grill-me) → `shaped` → (planner) → `promoted`
or `new` → (planner) → `promoted` (when no shaping needed)

**`[plan-item]` in plan.md:**
`new` → `shaping` → `shaped` → `ready` → `promoted` → `done`

**`[task]` in todo.md:**
`pending` → `in-progress` → `done | failed | blocked`

**`[note]` in bugs.md / tech-debt.md:**
`new` → (architect) → `promoted` (and entry is removed from source file once it lives in inbox)
or `new` → (fix lands) → entry removed
or `new` → (ADR drafted) → entry removed (ADR is the durable record)
