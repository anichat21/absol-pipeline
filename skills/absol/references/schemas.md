# Absol schemas — the single home for every data shape

Rule: a schema is written out **here and nowhere else**. Skills and agents reference this file;
each agent's definition inlines only the event block that agent itself writes.

## The item — `.absol/inbox.md`, `.absol/bugs.md`, `.absol/tech-debt.md`

One shape across all three files (the ledger, sharded by type). An item grows in place as tools
enrich it; it never moves, never changes status, and is deleted by the finalizer when its work
completes. Whether an item is planned/running is **derived** (its ID appears in a plan block /
in run.md), never stored.

```
- [item] BUG-014                     ← prefix per file: INBOX- | BUG- | DEBT-
  - title: short descriptive title
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE | VERIFY
  - priority: critical | high | medium | low
  - subsystem: affected area
  - shape: |                         ← shaper / transcribed user decisions (optional)
      Shaped YYYY-MM-DD.
      In: … Out: … Refuse: …         ← the hard-fail boundary is mandatory when shaped
      Decisions: … Delegated: …
  - map: |                           ← research output (optional; dated — staleness is git-checked)
      Mapped YYYY-MM-DD.
      Entry points: … Changes: … Blast radius: … Consumers: …
      Sync hazards: … Patterns to mirror: … Gotchas: …
  - plan: |                          ← planner output (optional; dated; makes the item PRIMED)
      Planned YYYY-MM-DD. Simplest-that-clears-the-bar: <one line>.
      - [task] BUG-014.1
        - title, description         ← description carries approach + entry points + constraints
        - files_touched: src/a.ts, …
        - dependencies: none | BUG-014.2
        - acceptance_criteria, verification
        - verify_oracle: unit | integration | human
        - risk: low | medium | high
        - executor_tier: micro | full
        - execution_order: 1
      - [task] BUG-014.2 …
  - covers: BUG-015, INBOX-021       ← lead item of a group plan (optional)
  - planned_with: BUG-014            ← covered item's pointer to its lead (optional)
  - prior: archive/2026-06.md#RUN-…  ← earlier run touched this (optional)
```

- Task IDs are namespaced by item (`BUG-014.1`) — no global counter, no allocation races.
- Item counters are per-file and **never reset**: next = max(this file, `grep` of `archive/`).
- `type: VERIFY` items are owed human smoke, appended by the finalizer
  (`title: eyeball <what>`, description says what to check and which run built it). The front
  door deletes one when the user confirms the smoke; a failed smoke becomes a BUG via note-taker.

### Field semantics

- **shape** — human decisions only; binding. The one enrichment that can require the user.
  Must include the refuse-boundary (what is out-of-format / rejected, not recovered).
- **map** — codebase facts. Regenerated when stale; never contains decisions.
- **plan** — the stored, runnable design. Staleness is mechanical, not calendar:
  `git log --since=<planned date> -- <files_touched>` per task; touched files → re-map + amend
  just those tasks at launch.
- **verify_oracle** — who can judge correctness. `unit`: the suite settles it. `integration`:
  a runtime probe must exercise the real seam and assert the real result — string-inspecting
  generated output is never enough. `human`: only a person can judge (visual/audio/device
  feel); the run records it as an owed VERIFY item, never as silently done.
- **executor_tier** — `micro`: single-file, low-risk, unambiguous → orchestrator edits inline.
  `full` → executor agent.

## `.absol/run.md` — transient run log

Exists ⇔ a run is open. **File mtime is the liveness signal** — no timestamps are copied
anywhere. Header is write-once; everything else is append-only events. Tasks are NOT copied
here — they live in the items' plan blocks; the orchestrator passes each agent its task inline.

```
# RUN-2026-07-01            ← -2, -3 for same-day reruns (check archive for collisions)
- mode: pipeline | scratchpad
- afk: yes | no
- items: BUG-014, INBOX-021
- started: <ISO>

## Events

- [event] <ISO>
  - type: task-started
  - task: BUG-014.1
  - worker: executor | inline | scratchpad

- [event] <ISO>
  - type: task-completed
  - task: BUG-014.1
  - files_touched_actual: src/a.ts, src/a.test.ts
  - summary: one factual line
  - verification_result: pass | fail | skipped (<reason>)
  - review_flag: yes | no

- [event] <ISO>
  - type: task-failed | task-blocked
  - task: BUG-014.1
  - files_touched_actual: <even if partial>
  - blocker: one line

- [event] <ISO>
  - type: task-retry
  - task: BUG-014.1
  - retry_count: 1                   ← total retries per task ≤ 2, shared between
  - reason: verification | review    ←   verification failures and fix-required reviews
  - amendment: one line — what the planner changed

- [event] <ISO>
  - type: review
  - task: BUG-014.1
  - verdict: approved | fix-required | blocked | human-check
  - evidence: what was checked
  - issues: <list | none>
  - fix_request: <specific | n/a>

- [event] <ISO>
  - type: pause | resume             ← pause carries next_task
```

Worker/reviewer fields carry **roles, not model names** — models are deployment detail.

Scratchpad runs have no plan blocks to reference: the `task-started` event carries
`title:` and `description:` inline; task IDs are `SCR.1`, `SCR.2`, …

## `.absol/archive/YYYY-MM.md` — append-only history

The finalizer appends one block per run. Files are never renamed, merged, or deleted.
Outcome-only — plan-time specs are not copied.

```
## RUN-2026-07-01 · pipeline · 2026-07-01 · 3 done, 1 failed (· Crashed: yes)
Items: BUG-014 (done), INBOX-021 (partial)
- BUG-014.1 done — summary. files: src/a.ts. verify: pass.
- BUG-014.2 failed (×2) — blocker. files: src/b.ts.
- Notable: <only what a future run must know>          (omit if none)
```

`prior:` links use anchors: `archive/2026-07.md#RUN-2026-07-01`.

## `state.md` (project root) — finalizer-written snapshot

No transient sections, ever. Liveness lives in run.md's existence.

```
# {Project} — Current State
*Last updated: {date}*

## Last Session
{1–3 sentences: what ran, what completed, what failed.}

## Open Threads
{Failed/blocked items with a prior: anchor, one line each. "None."}
```

Owed smoke is NOT here — it's VERIFY items in inbox.md.

## Verdict — when an agent returns to its caller

`verdict: approved | fix-required | blocked | human-check | human-required`
(`human-required` = the caller must get a user decision, e.g. planner sees grouped items that
don't share a fix.)

## Derived views (never stored)

- Item is **planned** ⇔ its ID appears in a plan block (own or a lead's `covers:`).
- Item is **primed** ⇔ shaped (or trivially unambiguous) + has a fresh plan.
- Run **live** ⇔ run.md exists and mtime < 15 min. **Paused** ⇔ last event is `pause`.
  **Crashed** ⇔ run.md exists, mtime ≥ 15 min, last event isn't `pause`.
- Banner counts = grep of the three intake files + archive tail.
