# Absol Workflow Schemas

All markdown data files use these compact, machine-readable schemas. Each item is a markdown list block with stable field names. Avoid prose — keep entries scannable.

All paths assume the `.absol/` layout. Legacy flat-layout projects use root-level paths until migrated.

---

## `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md` — `[note]`

One unified schema across all three intake files. ID prefix is the only difference. Note-taker is the sole writer of new entries; shaper/research annotate (`shaper_notes` / `research_notes`); planner / architect promote; finalizer removes when the owning plan completes.

```
- [note]
  - id: INBOX-001 | BUG-001 | DEBT-001
  - title: short descriptive title
  - description: 1–2 sentence precise explanation (verbatim or lightly cleaned from source)
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area
  - status: new | promoted
  - promoted_to: PLAN-NNN          (optional, set when planner/architect pulls it as a seed)
  - shaper_notes: |                (optional, set when /absol-shaper has refined this note standalone)
      Constraints captured during shaper session:
      - what the user clarified
      - what they ruled in / out
      - any pre-approved decisions
  - research_notes: |              (optional, set when /absol-research mapped this seed before planning)
      Codebase map (researched YYYY-MM-DD):
      - entry points, blast radius (files that must change), consumers
      - sync hazards, patterns to mirror, gotchas
  - prior_work: SCR-NNN (partial — see archive/run-SCR-NNN.md)
                                   (optional, set when a scratchpad partially worked on this note then escalated to pipeline. Next planner reads the linked archive for context.)
```

**`shaper_notes` vs `research_notes`.** Both annotate a seed before planning, but they differ in author, content, and lifecycle. `shaper_notes` = user intent (binding decisions) — copied into the plan's `[seed]` block because the *executor* must honour them at runtime. `research_notes` = codebase facts (coverage) — consumed by the *planner* to produce accurate `files_touched` and task descriptions, then **spent**; it is NOT copied into the plan seed, so `plan.md` and the archive stay lean. Both die with the note when the finalizer prunes it.

---

## `.absol/plan.md` — Plan Queue

A queue of plans authored by `absol-planner` or `absol-architect`. Each plan is a self-contained unit: title, summary, the seeds it consumes from inbox/bugs/tech-debt, and the actionable tasks the executor will run. Plans are separated by `---`.

Plan.md is **per-run** state. Finalizer archives completed plans into the run log and removes them from plan.md. Plans never accumulate across runs.

```
# Plan Queue

---

## PLAN-001: <global plan title>

- meta:
  - id: PLAN-001
  - status: ready | in-progress | done
  - created: YYYY-MM-DD
  - author: planner | architect

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
      Constraints captured during /absol-shaper session.
      (Field is omitted if no shaper involvement for this seed.)

### Execution

- [task]
  - id: TSK-001
  - title: action-oriented short title
  - description: concrete, references files/functions/modules by name
  - subsystem: affected area
  - files_touched: src/foo.ts, src/bar.ts        (planner's prediction)
  - dependencies: none | TSK-xxx, TSK-yyy
  - acceptance_criteria: how to verify the slice is demoable end-to-end
  - verification: command or check to run after the task
  - verify_oracle: unit | integration | human    (who can judge correctness — see below)
  - risk: low | medium | high
  - executor_tier: micro | full
  - execution_order: 1
  - status: pending                              (optional; default pending; crash recovery may flip to needs-review; finalizer may set failed/blocked)

- [task]
  - id: TSK-002
  - …

---

## PLAN-002: <next plan title>

…
```

Status lifecycle for plan: `ready` → (pipeline picks plan) → `in-progress` → (all tasks complete) → `done` → (finalizer archives + removes)

**Vertical-slice rule** — every `[task]` is a tracer bullet through every layer it touches. Pure horizontal tasks ("rewrite all schemas first") are forbidden.

**Execution is unattended.** Every consequential decision (schema/migration, destructive ops, API surface, new deps, breaking changes) is settled during shaping and carried as binding constraints in the seed's `shaper_notes`; tasks don't pause for input. (Interrupt mechanics — failure, `human-check`, manual pause — live in `absol-orchestrate`.)

**`executor_tier`** — `micro` runs inline in the orchestrator (no agent spawn). `full` spawns the executor agent. The planner picks the tier; the orchestrator trusts it.

**`verify_oracle`** — who can actually judge this task is correct, set by the planner. The lever against "green tests, broken feature": a `unit` oracle must never sign off on work only a probe or a human can verify.
- `unit` — the test suite / `verification` command is sufficient (logic, data shapes, pure functions).
- `integration` — needs a **runtime probe** that exercises the real seam (mount the registry and assert the query returns >0; hit the endpoint and assert the shape the UI consumes). String-inspecting generated output is NOT enough; `verification` must name the probe.
- `human` — only a person can judge (visual/audio feel, real-device behaviour). No automated oracle exists, so the run records it as **owed human smoke** at finalize rather than silently calling it done.

**`files_touched`** — planner's prediction. Actual files-touched is recorded per task in run-active.md as the executor runs. Divergence (executor touches files the planner didn't list) auto-sets `review_flag: yes` on the task event — keeps the planner honest over time without paying a cost when prediction was accurate.

---

## `.absol/run-active.md` — the live run log

The single source of truth during a run (pipeline or scratchpad). Has three sections:

1. **Header** — run metadata; mutated only by orchestrator/scratchpad.
2. **Tasks (snapshot)** — `[task]` entries copied from plan.md at session start; static planner-emitted fields only. Read-only after creation.
3. **Events** — append-only `[event]` log. Agents only ever append. Orchestrator appends events too (retry triggers, pause).

This shape exists for two reasons: **agents save tokens** by not parsing the file (orchestrator passes them their task entry directly in the prompt), and **crash recovery** is trivial (the file's existence + last_event_at timestamp tell `/absol` whether the run is live, paused, or crashed).

```
# Active Run

- run_id: RUN-2026-05-06           (or SCR-2026-05-06 for scratchpad)
- mode: pipeline | scratchpad
- started_at: 2026-05-06T14:00:00
- last_event_at: 2026-05-06T14:32:00
- plans: PLAN-001, PLAN-002        (omit for scratchpad mode)

## Tasks (snapshot)

- [task]
  - id: TSK-001
  - plan_id: PLAN-001
  - run_id: RUN-2026-05-06
  - <all static fields copied verbatim from plan.md execution section>

- [task]
  - id: TSK-002
  - …

## Events

- [event] 2026-05-06T14:00:30
  - type: task-started
  - task_id: TSK-001
  - worker: sonnet | opus | inline | scratchpad

- [event] 2026-05-06T14:02:15
  - type: task-completed
  - task_id: TSK-001
  - status: done
  - files_touched_actual: src/auth.ts, src/auth.test.ts
  - summary: one line — what was actually done
  - verification_result: pass
  - review_flag: no

- [event] 2026-05-06T14:02:30
  - type: task-failed
  - task_id: TSK-002
  - retry_count: 1
  - blocker: type error in cache.ts:42
  - files_touched_actual: src/cache.ts

- [event] 2026-05-06T14:02:45
  - type: task-retry
  - task_id: TSK-002
  - retry_count: 2
  - planner_amendment: <one-line of what planner changed in the task brief>

- [event] 2026-05-06T14:05:00
  - type: review
  - task_id: TSK-001
  - reviewer: sonnet | opus
  - verdict: approved | fix-required | blocked | human-check
  - issues: <list, or "none">
  - fix_request: <text, or "n/a">

- [event] 2026-05-06T14:35:00
  - type: pause
  - reason: user-requested
  - last_completed_task: TSK-004
  - next_task: TSK-005
```

### Event types

| `type:` | Written by | Purpose |
|---|---|---|
| `task-started` | executor (or orchestrator for inline micro) | Mark task begin |
| `task-completed` | executor | Success; carries run-time fields |
| `task-failed` | executor | Verification failed or executor reports failed |
| `task-blocked` | executor | Task can't proceed; blocker described |
| `task-retry` | orchestrator | Test-fail loop initiated a retry |
| `review` | reviewer / reviewer-complex | Verdict on a task |
| `pause` | orchestrator | User manually paused; pipeline frozen at task boundary |
| `resume` | orchestrator | Pipeline resumed from pause |

### Static rules

- **Append-only for agents.** Executor and reviewer agents NEVER read or modify run-active.md beyond appending an event block. They get their task entry passed in the prompt by the orchestrator.
- **Header mutation.** Only orchestrator/scratchpad updates `last_event_at` (after every event append). Other header fields are write-once at session start.
- **Tasks section is immutable** after orchestrator writes it at session start. Status flips happen via events, not by editing the snapshot. (The snapshot is the static plan; the event stream is the run-time truth.)
- **Finalizer reconciles.** Walks events, builds the per-task final state, writes the durable `archive/run-{run_id}.md`, then deletes run-active.md.

---

## Scratchpad Convention

Scratchpad mode uses the same run-active.md shape with `mode: scratchpad`. Synthetic IDs:

- task IDs: `SCR-001`, `SCR-002` … (counter resets per scratchpad session)
- `plan_id: SCRATCHPAD` sentinel (no plan.md entry exists)
- `run_id: SCR-{YYYY-MM-DD}` (or `-2`, `-3` for same-day reruns)
- worker on every task event: `scratchpad`

If the session pulled a `[note]` from inbox/bugs/tech-debt, mark that note `status: promoted` and set `promoted_to: SCR-NNN`. Finalizer removes it on close. **If the scratchpad escalates to pipeline before completing the pulled note's work, demote the note back to `status: new` (drop `promoted_to`) before close** — otherwise the note sits flagged-as-resolved-but-isn't.

---

## `state.md` — current-truth snapshot + transient run state

Three persistent sections plus up to two transient sections.

```
# {Project} — Current State

*Last updated: {date}*

## Last Session                  (persistent — finalizer-written)
{1–3 sentence summary of the most recent run.}

## In Progress                   (persistent — finalizer-written)
{Plans with status: in-progress; one line each. "Nothing." if none.}

## Parked Items                  (persistent — finalizer-written)
{Notes with shaper_notes but no promoted_to; one line each. "None." if none.}

## Active Run                    (transient — only present while a run is open)
- run_id: RUN-2026-05-06 | SCR-2026-05-06
- mode: pipeline | scratchpad
- started_at: 2026-05-06T14:00:00
- last_event_at: 2026-05-06T14:32:00

## Pause                         (transient — only present while paused)
- run_id: RUN-2026-05-06
- paused_at: 2026-05-06T14:32:00
- last_completed_task: TSK-004
- next_task: TSK-005
- reason: user-requested
```

`## Active Run` is written by orchestrator/scratchpad at session start, removed by finalizer on close. `last_event_at` is updated by orchestrator/scratchpad whenever they append to run-active.md (so `/absol`'s recovery check has a fresh timestamp without parsing run-active.md).

`## Pause` is written by orchestrator on user-requested pause, removed by finalizer (after Resume → finalize) or by `/absol` (after Finalize-away → finalize).

### Recovery

`## Active Run` / `## Pause` / `run-active.md` presence + `last_event_at` determine the run state at `/absol` entry (Clean, Live-elsewhere, Crashed, Paused, two drift states). The recovery state matrix and the crash auto-recovery protocol live in **`absol/SKILL.md`** (the only actor) — not duplicated here. Crash recovery writes the same archive shape as a finalize with `Crashed: yes`; the 15-min `last_event_at` threshold distinguishes a live slow task from a crash.

---

## `.absol/archive/`

Finalizer's records. All **outcome-only** — no plan-time specs (those die with plan.md):

- `archive/run-{run_id}.md` — the reconciled record of a run: counts line, plans line, one line per task (`id status — summary. files: …. verify/review …`), optional Notable section. The only durable run history. See `absol-finalizer` Step 3 for the exact shape; the crash path in `absol/SKILL.md` writes the same shape with `Crashed: yes`.
- `archive/runs-{YYYY-MM}.md` — run archives from before the current month, rolled together by finalizer (then the individual `run-*.md` files are deleted). Keeps file count bounded.
- `archive/sessions-{YYYY-MM}.md` — one-line summaries for older sessions, rolled in to keep `state.md` lean.

`state.md` itself is a current-truth snapshot. No historical stacking.

---

## ID Conventions

| Prefix | Source |
|---|---|
| `INBOX-` | `.absol/inbox.md` notes |
| `BUG-` | `.absol/bugs.md` notes |
| `DEBT-` | `.absol/tech-debt.md` notes |
| `PLAN-` | `.absol/plan.md` plans |
| `TSK-` | `[task]` entries (in plan.md and run-active.md) |
| `SCR-` | scratchpad task IDs in `run-active.md` |
| `RUN-` | pipeline run IDs (`RUN-YYYY-MM-DD`, `-2`, `-3` for same-day reruns) |
| `ADR-` | `.absol/adr/` decision records (file names: `NNNN-short-slug.md`) |

IDs are monotonically increasing within each file. When promoting items between files (note → plan as seed, etc.), keep the source ID and reference it via the `[seed].id` and source-side `promoted_to` fields.

---

## Task Classes

| Class | Use for | Where allowed |
|---|---|---|
| ARCH | Architectural changes, refactors that alter system structure | plan.md, run-active.md |
| FEATURE | New user-facing functionality | plan.md, run-active.md |
| BUG | Broken behaviour that needs fixing | plan.md, run-active.md |
| TWEAK | Small improvements to existing behaviour | plan.md, run-active.md |
| CHORE | Maintenance, deps, config, docs, cleanup | plan.md, run-active.md |
| DISCUSS | Ideation-only scratchpad sessions — no code changes, just a summary of what was discussed | run-active.md only (scratchpad mode) |

`DISCUSS` tasks have `files_touched: none`, `files_touched_actual: none`, `verification: n/a`, `executor_tier: n/a`. They never appear in plan.md; the planner doesn't emit them. Scratchpad emits one at session close when no other tasks were created — preserves a light record of the conversation without forcing a fake "execution" shape. (`executor_tier` is `micro | full` only for pipeline tasks that the orchestrator routes; scratchpad tasks always run inline as `worker: scratchpad`, so they carry `executor_tier: n/a`.)

---

## Status lifecycles

**`[note]` in inbox.md / bugs.md / tech-debt.md:**
`new` → (planner/architect picks as seed, OR scratchpad pulls) → `promoted` → (owning plan/scratchpad completes; finalizer removes the entry)

If a scratchpad escalates to pipeline before resolving the pulled note: scratchpad demotes the note back to `new` (drop `promoted_to`) before closing.

**Plan in plan.md:**
`ready` → (pipeline starts on it) → `in-progress` → (all tasks complete) → `done` → (finalizer archives + removes)

**`[task]` in plan.md (planner-emitted; per-plan persistent until done):**
`pending` (default) → executed by pipeline → `done` (finalizer prunes the entry) | `failed` | `blocked`
`pending` → crash before completion → stays `pending` (next run picks up).
Crashed run had this task `done` in events → flipped to `needs-review` by /absol's crash recovery; next run re-executes with mandatory reviewer pass.

**`[task]` in run-active.md (per-run; state derived from events):**
`pending` (initial snapshot) → `in-progress` (task-started event) → `done | failed | blocked | needs-review` (terminal events)

A task in `failed` may auto-retry up to 2 times via the planner→executor→tester loop (`retry_count` field on retry events). After 2 retries the orchestrator surfaces the failure to the user with three options: **Solve now** (re-loop), **Log and finalise** (record failure, finalize), or **Discuss** (log + finalise + open scratchpad).

---

## Verdict shape — when an agent returns to its caller

Every agent that returns control to a caller (orchestrator, /absol) emits a verdict line. Used by the caller to route the next step.

```
verdict: approved | fix-required | blocked | human-check | human-required
```

- `approved` — work is good, proceed.
- `fix-required` — specific issues need addressing; details in `fix_request`.
- `blocked` — can't proceed; details in `blocker`.
- `human-check` — agent isn't sure; needs human to verify (UI/UX, ambiguous business logic).
- `human-required` — agent needs the user to make a decision before proceeding (e.g. planner sees seeds that don't share a fix; emits a recommended regrouping for the user to confirm).
