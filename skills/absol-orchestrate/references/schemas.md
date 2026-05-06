# Absol Workflow Schemas

All markdown data files use these compact, machine-readable schemas. Each item is a markdown list block with stable field names. Avoid prose — keep entries scannable.

All paths assume the `.absol/` layout. Legacy flat-layout projects use root-level paths until migrated.

---

## `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md` — `[note]`

One unified schema across all three intake files. ID prefix is the only difference. Note-taker is the sole writer; planner promotes; finalizer removes when the owning plan completes.

```
- [note]
  - id: INBOX-001 | BUG-001 | DEBT-001
  - title: short descriptive title
  - description: 1–2 sentence precise explanation (verbatim or lightly cleaned from source)
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area
  - status: new | promoted
  - promoted_to: PLAN-NNN          (optional, set when planner pulls it as a seed)
  - shaper_notes: |                (optional, set when /absol-shaper has refined this note standalone)
      Constraints captured during shaper session:
      - what the user clarified
      - what they ruled in / out
      - any pre-approved decisions
```

ID prefix matches destination. Counters are independent per file. Read the file, find the highest ID with that prefix, increment.

---

## `.absol/plan.md` — Plan Queue

A queue of plans authored by `absol-planner`. Each plan is a self-contained unit: title, summary, the seeds it consumes from inbox/bugs/tech-debt, and the actionable tasks the executor will run. Plans are separated by `---`.

Plan.md is **per-run** state. Finalizer archives completed plans into the run log and removes them from plan.md. Plans never accumulate across runs.

```
# Plan Queue

---

## PLAN-001: <global plan title>

- meta:
  - id: PLAN-001
  - status: ready | in-progress | done
  - created: YYYY-MM-DD
  - shaper_session: yes | no

### Summary

<2–3 sentences on what this plan accomplishes and why it matters now>

### Seeds

- [seed]
  - id: INBOX-042 | BUG-017 | DEBT-008
  - title: <carried verbatim from source [note]>
  - description: <carried verbatim from source [note]>
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: <area>
  - shaper_notes: |
      Constraints captured during /absol-shaper session:
      - what the user clarified
      - what they ruled in
      - what they ruled out
      (Field is omitted if the planner had no shaper involvement for this seed.)

### Execution

- [task]
  - id: TSK-001
  - title: action-oriented short title
  - description: concrete, references files/functions/modules by name
  - subsystem: affected area
  - files_touched: src/foo.ts, src/bar.ts
  - dependencies: none | TSK-xxx, TSK-yyy
  - acceptance_criteria: how to verify the slice is demoable end-to-end
  - verification: command or check to run after the task
  - risk: low | medium | high
  - hitl: yes | no
  - executor_tier: micro | full
  - execution_order: 1

- [task]
  - id: TSK-002
  - …

---

## PLAN-002: <next plan title>

…
```

Status lifecycle for plan:
`ready` → (pipeline picks plan) → `in-progress` → (all its tasks complete) → `done` → (finalizer archives and removes)

**Vertical-slice rule** — every `[task]` is a tracer bullet through every layer it touches. Pure horizontal tasks ("rewrite all schemas first") are forbidden.

**HITL flagging** — `hitl: yes` tasks pause the executor for user input. The planner clusters HITL tasks at the start of a plan when dependencies allow, otherwise at the end. Never interleave HITL with AFK runs of work.

**`executor_tier`** — `micro` runs inline in the orchestrator (no agent spawn). `full` spawns the executor agent. The planner picks the tier; the orchestrator trusts it.

**`files_touched`** — planner's prediction. Actual files-touched is recorded in `todo-run.md` per task as the executor runs (and may differ).

---

## `.absol/todo-run.md` — `[task]` (the execution journal)

Per-session execution surface. At pipeline launch, orchestrator copies each `[task]` from selected plans into todo-run.md and adds run-time fields as the task progresses. Cleared every finalize.

```
- [task]
  - id: TSK-001
  - plan_id: PLAN-NNN              ← FK to the source plan in plan.md
  - run_id: RUN-2026-05-06
  # static fields copied from plan.md:
  - type, title, description, subsystem
  - dependencies, acceptance_criteria, verification
  - risk, hitl, executor_tier, execution_order
  # mutates as the task runs:
  - status: pending | in-progress | done | failed | blocked | needs-review
  - worker: sonnet | opus | inline | scratchpad
  - files_touched_actual: path/a.ts, path/b.ts        (filled in post-execution)
  - summary: one-line description of what was done
  - verification_result: pass | fail | skipped
  - blocker: description (or: none)
  - review_flag: yes | no
  - retry_count: 0                                    (incremented on test-fail auto-loop)
```

**`worker: inline`** means orchestrator ran a `executor_tier: micro` task directly without spawning an agent.

**`worker: scratchpad`** means a scratchpad-mode session wrote this entry. `task_id` is `SCR-{n}` in that case (see Scratchpad Convention below).

---

## Scratchpad Convention

Scratchpad mode logs adhoc work into todo-run.md using the same `[task]` schema. Synthetic IDs:

- `task_id: SCR-001` (counter resets per scratchpad session)
- `plan_id: SCRATCHPAD` (sentinel, no plan.md entry exists)
- `run_id: SCR-{YYYY-MM-DD}` (or `-2`, `-3` for same-day reruns)
- `worker: scratchpad`

If the session pulled a `[note]` from inbox/bugs/tech-debt, mark that note `status: promoted` and set `promoted_to: SCR-NNN`. Finalizer removes it on close (same path as plan-completed promotions).

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

Reviews are appended to todo-run.md alongside the `[task]` they critique.

---

## Pause state — `state.md`

When a pipeline is paused mid-run, the finalizer/orchestrator records pause metadata in `state.md` under a `## Pause` section. While present, `/absol` rejects new pipeline starts and blocks scratchpad mode.

```
## Pause

- run_id: RUN-2026-05-06
- paused_at: 2026-05-06T14:32:00
- last_completed_task: TSK-004
- next_task: TSK-005
- reason: user-requested
```

The section is removed when the user resumes or finalizes-away the pause.

---

## `.absol/archive/`

Two file shapes survive a run:

- `archive/run-{RUN-ID}.md` — full snapshot of `todo-run.md` plus the plan(s) that ran. Written by finalizer. Only durable history of the run.
- `archive/sessions-{YYYY-MM}.md` — one-line summaries for older sessions, rolled in by finalizer to keep `state.md` lean.

`state.md` itself is a current-truth snapshot. No historical stacking.

---

## ID Conventions

| Prefix | Source |
|---|---|
| `INBOX-` | `.absol/inbox.md` notes |
| `BUG-` | `.absol/bugs.md` notes |
| `DEBT-` | `.absol/tech-debt.md` notes |
| `PLAN-` | `.absol/plan.md` plans |
| `TSK-` | `[task]` entries (in plan.md and todo-run.md) |
| `SCR-` | scratchpad task IDs in `todo-run.md` |
| `RUN-` | pipeline run IDs (`RUN-YYYY-MM-DD`, `-2`, `-3` for same-day reruns) |
| `ADR-` | `.absol/adr/` decision records (file names: `NNNN-short-slug.md`) |

IDs are monotonically increasing within each file. When promoting items between files (note → plan as seed, etc.), keep the source ID and reference it via the `[seed].id` and source-side `promoted_to` fields.

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

**`[note]` in inbox.md / bugs.md / tech-debt.md:**
`new` → (planner picks as seed, OR scratchpad pulls) → `promoted` → (owning plan/scratchpad completes; finalizer removes the entry)

**Plan in plan.md:**
`ready` → (pipeline starts on it) → `in-progress` → (all tasks complete) → `done` → (finalizer archives + removes)

**`[task]` in todo-run.md:**
`pending` → `in-progress` → `done | failed | blocked | needs-review`

A task in `failed` may auto-retry up to 2 times via the planner→executor→tester loop (`retry_count` field). After 2 retries the orchestrator surfaces the failure to the user with three options: solve-now (re-loop), log-and-finalise (record failure, finalize), or discuss (log + finalise + open scratchpad).
