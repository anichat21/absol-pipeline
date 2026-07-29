# Absol schemas — the single home for every data shape

Rule: a schema is written out **here and nowhere else**. Skills and agents reference this file;
each agent's definition inlines only the event block that agent itself writes.

## The toolset — the write path

State changes to ledger items, tags, run.md events, and the portfolio go through the CLI:

```
node /mnt/nas/dev/projects/absol/tools/absol-tool.mjs <verb> …
```

Verbs: `add` (allocates the next ID, archive included) · `update` (fields; `--block shape|map|plan`
from stdin) · `tag` / `untag` · `remove` · `append-event` (system-clock ISO stamp) · `lint`
(structural conformance, file or whole project) · `query` (filtered JSON — the read path for
agents and renderers) · `portfolio list|get|add|set`. Run any verb with `--help` for flags.

Hand-edits remain legal — they must pass `lint`. Archive blocks and state.md are prose surfaces
(finalizer-written); the toolset does not manage them. The parser library
(`tools/lib/parse.mjs`) is the single implementation of these schemas — renderers import it
rather than re-parsing.

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
  - description: |                   ← free prose detail — repro, context, evidence (optional)
      what/where/why in as many lines as it needs
  - shape: |                         ← shaper / transcribed user decisions (optional)
      Shaped YYYY-MM-DD.
      In: … Out: … Refuse: …         ← the hard-fail boundary is mandatory when shaped
      Decisions: … Delegated: …
  - map: |                           ← research output (optional; dated — staleness is git-checked)
      Mapped YYYY-MM-DD.
      Entry points: … Changes: … Blast radius: … Consumers: …
      Sync hazards: … Patterns to mirror: … Gotchas: …
      Full detail: reviews/YYYY-MM-DD-<ID>-map.md   ← only when raw fan-out output is big;
                                                    ←   the block above stays condensed
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
  - open: <question> (YYYY-MM-DD)    ← the question that blocked AFK shaping (optional)
  - smell: <diagnosis> (YYYY-MM-DD)  ← why attempts kept failing — zoom-out, not patch trail (optional)
  - tags: tuning, rtr, parked        ← optional. tuning = quiet lane: real work, suppressed from
                                     ←   the banner and default lists; shown on request.
                                     ←   rtr = owner pre-authorization for unattended execution;
                                     ←   records the authorization only — readiness stays derived.
                                     ←   parked = owner deferred it: quiet lane, excluded from
                                     ←   type-wide run selections; only an explicit ID runs it
```

- Task IDs are namespaced by item (`BUG-014.1`) — no global counter, no allocation races.
- Item counters are per-file and **never reset**: next = max(every ID trace in `.absol/`,
  the `<!-- counter: N -->` preamble line). The counter line is the allocation floor the
  toolset's `add` maintains — it keeps IDs monotonic even when an item is removed before
  leaving an archive trace; max() semantics make a stale line harmless.
- `type: VERIFY` items are the **smoke ledger** — a reference checklist the user consults so
  nothing gets missed, appended by the finalizer (`title: eyeball <what>`, description says
  what to check and which run built it). The front door deletes one when the user confirms the
  smoke; a failed smoke becomes a BUG via note-taker. **Decay — silence is a pass** (doctrine):
  the finalizer deletes any VERIFY item whose minting run is ≥4 runs back in the archive with
  no related BUG filed since, recording one archive line: `presumed passed in use`. A new
  release supersedes older VERIFY items on the same surface immediately.

### Field semantics

- **shape** — human decisions only; binds unattended runs. The one enrichment that can require
  the user. Must include the refuse-boundary (what is out-of-format / rejected, not recovered).
  The owner's live word supersedes any shape line on contact — rewrite the line, report in one
  line (doctrine.md).
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

Exists ⇔ a run is open. **File mtime is the liveness signal** — timestamps are never copied
as state; the finalizer derives durations from them once, at close. `<ISO>` is full ISO with
seconds (`2026-07-01T14:03:22+02:00`). Header is write-once; everything else is append-only
events. Tasks are NOT copied here — they live in the items' plan blocks; the orchestrator
passes each agent its task inline.

```
# RUN-2026-07-01            ← -2, -3 for same-day reruns (check archive for collisions)
- mode: pipeline | scratchpad
- afk: yes | no
- items: BUG-014, INBOX-021
- started: <ISO>

## Events

Every `<ISO>` stamp comes from the system clock (`date -u +%FT%TZ`) — never composed from
memory; self-authored stamps have landed before their own task's start.

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
  - resolves: BUG-004                ← scratchpad only: ledger item(s) this task completes;
                                     ←   the finalizer deletes them (pipeline tasks never carry it)

- [event] <ISO>
  - type: task-failed | task-blocked
  - task: BUG-014.1
  - files_touched_actual: <even if partial>
  - blocker: one line
  - smell: <one line — only on terminal failure after retries: what the failure pattern points at>

- [event] <ISO>
  - type: task-usage                 ← orchestrator-written when a delegated agent returns —
  - task: BUG-014.1                  ←   tokens from the agent notification's usage figure
  - tokens: 29K                      ←   (the worker can't know its own total). One per return;
                                     ←   retries produce additional events; finalizer sums them.
                                     ←   Inline and live-scratchpad tasks have no figure — no event

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
`title:` and `description:` inline; task IDs are `SCR.1`, `SCR.2`, … — **even when the work is
a pulled ledger item**. The item link is the `resolves:` field on the terminal event, never
the task ID.

## `.absol/archive/YYYY-MM.md` — append-only history

The finalizer appends one block per run. Files are never renamed, merged, or deleted.
Outcome-only — plan-time specs are not copied. Effort figures are derived here, once, from
run.md before it's deleted (task = task-started → latest terminal event, retries included;
run = `started:` → last event; tokens summed from `tokens:` fields) — omit whatever the
events don't carry. They're diagnostics for studying run norms, never promises.

```
## RUN-2026-07-01 · pipeline · 2026-07-01 · 3 done, 1 failed · 42m · 214K tok (· Crashed: yes)
Items: BUG-014 (done), INBOX-021 (partial)
- BUG-014.1 done (4m · 29K tok) — summary. files: src/a.ts. verify: pass.
- BUG-014.2 failed (×2) (11m · 88K tok) — blocker. files: src/b.ts.
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

## `portfolio.md` (absol repo root) — the estate ledger

One block per workspace entry (projects and knowledge_base both). Owner-set fields only —
activity, counts, and liveness are derived at read time from each project's own files, never
stored here. Written via `portfolio` verbs.

```
- [project] snowowl
  - status: active | simmering | frozen | done
  - next: one line — the next meaningful action     (optional while status is unset-fresh)
  - re-entry: one line — how to resume              (mandatory when frozen)
  - notes: free line                                (optional)
  - prod_url: http://…                              (optional — deployed app, prod; ArcticTern's
  - dev_url: http://…                               (optional — and dev; drives the Apps row)
```

## Verdict — when an agent returns to its caller

`verdict: approved | fix-required | blocked | human-check | human-required`
(`human-required` = the caller must get a user decision, e.g. planner sees grouped items that
don't share a fix.)

## Derived views (never stored)

- Item is **planned** ⇔ its ID appears in a plan block (own or a lead's `covers:`).
- Item is **primed** ⇔ shaped (or trivially unambiguous) + has a fresh plan.
- Item is **ready** (the night-run pickup set) ⇔ tagged `rtr` AND primed.
- Banner counts exclude `tags: tuning` and `tags: parked` items and enumerate no VERIFY items —
  quiet lanes show as counts only, listed on request.
- Run **live** ⇔ run.md exists and mtime < 15 min. **Paused** ⇔ last event is `pause`.
  **Crashed** ⇔ run.md exists, mtime ≥ 15 min, last event isn't `pause`.
- Banner counts = grep of the three intake files + archive tail.
