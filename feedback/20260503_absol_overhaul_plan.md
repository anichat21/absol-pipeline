# Absol Major Overhaul — 2026-05-03

A consolidated plan for the next big version of absol. Folds in five external skills (mattpocock's `grill-me`, `to-prd`, `to-issues`, `tdd`, `improve-codebase-architecture`), a file-layout restructure, a growth-control strategy informed by an audit of the snowowl project, and the live ideas from the May 1 token-optimization plan.

This is a strategy doc. Implementation lives in the per-skill edits that follow.

---

## 1. Why now

The pipeline works, but four structural gaps are showing up across real projects:

1. **Loose intake.** The shaper has no rigorous interview methodology, and the planner doesn't enforce slice shape — a single `[task]` can legitimately be "rebuild the schema layer" with no end-to-end demo. This produces tasks that fail late, not early.
2. **No shared vocabulary.** Each agent re-discovers domain terms by re-reading the codebase. Naming drifts between triage / planner / executor — "controls" in one phase becomes "settings tray" in the next.
3. **No decision log.** Architectural rejections aren't recorded. A future architect pass re-suggests the same things we already considered and rejected.
4. **File bloat.** Audit of snowowl: `inbox.md` is 822 lines, 100 % historical. `state.md` is 311 lines with a 146-line tech-debt section that grows monotonically. Files are doing two jobs (active workspace + permanent archive) and it's degrading every read.

Plus a holdover: the May 1 optimization plan identified ~100 K tokens / 10-task run of waste that hasn't been recovered yet.

---

## 2. What we keep

These are explicitly preserved — the overhaul does not redesign them:

- The pipeline shape: `intake → shape → triage → plan → checkpoint → execute → review → finalize`
- Agent isolation (every agent gets its own context via the Agent tool)
- Run IDs (`RUN-YYYY-MM-DD`) tying jobs together
- The mandatory finalization checkpoint at end of run
- Serial execution (one task at a time, no parallel)
- Two mandatory user checkpoints: post-plan and pre-finalize

The orchestrator stays a conductor. It does not gain implementation responsibilities.

---

## 3. Five external skill integrations

### Track 1 — `grill-me` becomes a standalone skill; shaper stays light

The shaper inside `absol-orchestrate` keeps doing its job, but stays light: at most 1–3 quick clarifying questions per vague item. If the item still isn't clear after the budget is spent, it gets parked with `status: needs-shaping` and the pipeline continues.

`/grill-me` becomes a separate user-invoked skill, ported from mattpocock. It runs the relentless interview methodology — one question at a time, recommend an answer per question, explore the codebase instead of asking when possible.

**Output destination: `plan.md`.** Grill-me produces a fully shaped item, which is past raw intake — `inbox.md` is the wrong home. It appends a structured shaped entry to `plan.md`, ready for the planner to consume on the next orchestrate run. If the user grilled an item that already lived in `inbox.md` with `status: needs-shaping`, grill-me also flips that inbox entry to `status: shaped` and references the new plan.md entry, so it doesn't sit in the inbox forever.

At the end of every orchestrate run, if there are parked items, the finalization summary suggests:

> "3 items parked as `needs-shaping`. Run `/grill-me` on them when you have time."

This means orchestrate stays unattended-friendly. The user never *has* to grill — they choose to.

### Track 2 — vertical slices + HITL/AFK in the planner

Two changes to `absol-planner` from mattpocock's `to-issues`:

**Vertical slice rule.** Every `[task]` must be a tracer bullet: a thin path through every layer it touches (schema + API + UI + test, where applicable). Pure horizontal tasks ("rewrite all schemas," "add all API endpoints") are forbidden. The planner explanation: build slice 1 working end-to-end, then slice 2, then slice 3. Each slice is independently demoable. This kills the "all schemas first, all APIs second, integrate at the end" pattern that fails late.

**HITL / AFK field on every task.**

- `hitl: yes` — task requires a human decision mid-execution (architecture, design, irreversible action). Pipeline pauses at task boundary, shows the task to the user, waits for input.
- `hitl: no` (default) — task can run unattended. Goes through micro / full executor without intervention.

The planner picks HITL for: ARCH tasks, schema migrations, anything touching auth or data integrity, tasks the user explicitly flagged. Everything else is AFK.

**HITL ordering rule.** The planner re-orders tasks so HITL ones cluster at the start of the run when the dependency graph allows; otherwise at the end. Beginning-cluster is preferred: the user sits through HITL prompts up front, then walks away while the AFK tail runs. End-cluster only when HITL tasks depend on AFK predecessors. Never interleave HITL between AFK runs of work — that defeats the "kick off and walk away" goal.

**HITL prompt shape.** When the pipeline pauses on a HITL task, it presents the full task entry (title, description, files involved, risk, dependencies) and accepts free-form input — not just `y/n`. The user can approve, reject, request changes, or pivot the approach. Pipeline routes the response back into the task before executing.

This lets the user kick off long pipelines and walk away. Pipeline only stops for the calls that genuinely need a human, and clusters those stops to minimise context-switches.

### Track 3 — TDD discipline in the executor

For `type: FEAT` and medium-or-higher-risk `BUG` tasks, the executor follows red-green-refactor:

1. **Red** — write one failing test for one behaviour.
2. **Green** — write the minimum code to pass it.
3. **Refactor** — clean up with tests as a safety net.
4. Repeat for the next behaviour.

Two anti-patterns the executor must explicitly reject:

- **Horizontal TDD** — writing all tests first, then all code. This produces tests that describe imagined behaviour instead of real behaviour. Forbidden.
- **Implementation tests** — tests that verify private functions, mock internal collaborators, or check data shapes instead of behaviour. The rule: a test that breaks when you rename a private function but behaviour is unchanged is a bad test.

`type: TWEAK` and `type: CHORE` skip TDD — the overhead isn't worth it for one-line CSS changes or asset removal.

This pairs naturally with vertical slices from Track 2: each slice gets its own red-green-refactor cycle.

### Track 4 — `absol-architect` as an on-demand skill

A new skill ported from mattpocock's `improve-codebase-architecture`. It is **not** part of `orchestrate`. The user invokes it manually when they want an architecture pass.

What it does:
- Walks the codebase looking for **shallow modules** (interface as complex as the implementation), **broken seams** (where coupling leaks across boundaries), and **untestable code**.
- Applies the **deletion test**: imagine deleting this module — does complexity vanish (it was a pass-through) or concentrate across N callers (it was earning its keep)?
- Surfaces a numbered list of *deepening candidates* — refactor opportunities that turn shallow modules into deep ones.
- Does **not** make code changes. It writes candidates back into `inbox.md` as `type: ARCH` items, which the next orchestrate run can plan and execute.

Cadence: user-driven. Recommended after major features ship, or when something feels off architecturally. Not auto-triggered.

### Track 5 — PRD ideas folded into `plan.md` schema

mattpocock's `to-prd` is overkill for solo work — user stories with stakeholders aren't a solo concept. But three of its sections are too good to skip:

- **Modules to build / modify** — names the deep modules being touched. Gives the planner concrete handles.
- **Testing decisions** — what to test, what not to. Prevents the "test everything" trap and the "test nothing" trap.
- **Out of scope** — kills feature creep mid-pipeline.

These get folded into the `plan.md` entry schema. Each shaped item in `plan.md` gains three optional sub-fields: `modules`, `testing`, `out_of_scope`. The planner consumes them when generating tasks.

No new file. No new phase. Just a richer schema for what's already there.

---

## 4. Foundational additions

### `CONTEXT.md` per project

A domain glossary. Lives at `.absol/CONTEXT.md`. Every agent reads it at start of run.

Contents:
- **Domain terms** — names of concepts in this project, their definitions, when to use which term. ("A `Variant` is a colour-and-finish combination on a Product. Don't say 'option,' 'choice,' or 'sku.'")
- **Naming conventions** — file names, component names, prefixes.

Lazily updated. When `grill-me` or `architect` introduces a new term, they offer to add it to CONTEXT.md inline. The note-taker can also append.

This is the single highest-leverage change for *consistency* across agents. Today triage might call something a "control," planner calls it a "setting," executor calls it a "toggle." After CONTEXT.md, everyone uses the project's word.

### ADR log per project

Architecture Decision Records. Lives at `.absol/adr/`. One file per load-bearing decision, numbered: `0001-no-graphql.md`, `0002-zustand-not-redux.md`.

Format (each file is short — 4 sections, 1–2 paragraphs each):

- **Status** — proposed / accepted / superseded
- **Context** — what problem we faced
- **Decision** — what we chose
- **Consequences** — tradeoffs we accepted

**Only the architect skill writes ADRs.** When the user rejects a deepening candidate with a real reason ("we need this shallow because X"), the architect proposes an ADR draft and asks the user to confirm before writing. No other component creates ADRs — not the planner, not note-taker, not the user manually (they can edit, but the architect owns the write path). This keeps the ADR log curated by one consistent voice and stops the file from filling with half-formed thoughts.

When read: planner and architect both scan the ADR log before suggesting. If a candidate contradicts an existing ADR, it's only surfaced when the friction is real enough to revisit — and it's flagged: *"contradicts ADR-0007 — but worth reopening because…"*.

This is the single highest-leverage change for *not re-litigating decisions*. ADR-0002 prevents the architect skill from suggesting Redux every time it runs.

### Absol-itself ADRs

Separate from per-project ADRs. Lives at `projects/absol/docs/adr/` (in absol's own repo). Records decisions about the pipeline shape: "why serial not parallel," "why finalizer is mandatory," "why grill-me lives outside orchestrate." Saves future-self from undoing decisions made for good reasons.

---

## 5. File restructure

Per-project layout, after overhaul:

```
my-app/
├── CLAUDE.md            ← root (Claude Code requires this here)
├── state.md             ← root (most-glanced "where am I" file)
├── vision.md            ← root (human-facing, read often)
├── roadmap.md           ← root (human-facing, read often)
└── .absol/              ← pipeline-owned, hidden
    ├── CONTEXT.md       ← glossary
    ├── adr/             ← decision records
    │   └── 0000-template.md
    ├── inbox.md         ← active intake
    ├── plan.md          ← shaped items (with PRD sub-fields)
    ├── todo.md          ← executable tasks
    ├── todo-run.md      ← live execution log
    ├── bugs.md          ← known bugs (was state.md "Known Bugs")
    ├── tech-debt.md     ← known debt (was state.md "Tech Debt")
    └── archive/
        ├── inbox-YYYY-MM-DD.md
        ├── RUN-YYYY-MM-DD.md
        └── sessions-YYYY-MM.md
```

Rationale:

- Root holds the four files a human reads first: project meta (`CLAUDE.md`), present truth (`state.md`), intent (`vision.md`, `roadmap.md`).
- `.absol/` is hidden because it's plumbing. Convention matches `.git/`, `.github/`, `.vscode/` — tooling state, not your code.
- The pipeline owns one folder end-to-end. Archive becomes a folder operation; finalizer's job is simpler.
- `bugs.md` and `tech-debt.md` are pulled out of `state.md` so `state.md` becomes a clean truth snapshot instead of a debt ledger.

### Information surfacing rule

The user should not have to open `state.md`, `bugs.md`, `tech-debt.md`, or `inbox.md` manually to find out what's going on. These files are **non-AI backups** — durable, human-readable, but not the primary interface.

The primary interface is on-demand: when the user asks "where's the project at" or kicks off `/absol-orchestrate`, the orchestrator (or a future `/absol-status` skill) reads the files and presents a single inline summary covering active work, parked items, top bugs, top debt, last session. Information appears once, in the right place, when asked. Files exist so the data survives a context window reset, not so the user has to read them.

This shapes other decisions throughout the doc — e.g. parked `needs-shaping` items get surfaced in the orchestrate finalization summary, not written into `state.md`.

### Gitignore policy

The `.gitignore` shipped by `absol-newproject` tracks the durable / decision-bearing files and ignores the churn:

- **Tracked at root:** `CLAUDE.md`, `state.md`, `vision.md`, `roadmap.md`
- **Tracked inside `.absol/`:** `CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`
- **Ignored inside `.absol/`:** `inbox.md`, `plan.md`, `todo.md`, `todo-run.md`, `archive/`

Rationale: glossary, decisions, vision, roadmap, bugs, debt, and the truth snapshot are all things a future contributor (or future-you) needs to make sense of the project. Inbox / plan / todo / todo-run / archive are pipeline state — they churn per run, they recover from finalize, they have no value in the git history.

---

## 6. File growth & archive strategy

### The findings

Audit of snowowl as of 2026-05-03:

- `inbox.md`: 822 lines, 100 % `status: promoted` — entirely historical, never archived.
- `state.md`: 311 lines, with a 146-line Tech Debt section growing monotonically.
- `state.md` Last Session: 68 lines, gaining a Batch sub-entry per run.

Other files (plan, todo, todo-run, vision, roadmap, CLAUDE) are healthy.

### The rules

**Rule 1 — Archive every finalize, not on a threshold.**

Finalizer already touches these files at end of run. Doing the archive there costs nothing extra. Threshold-based archival ("when inbox > 50 items") adds branching complexity for zero benefit.

**Rule 2 — Finalizer responsibilities expand.**

After every successful run, the finalizer:

1. Snapshot `inbox.md` items at `status: promoted` into `.absol/archive/inbox-{run_id}.md` and remove them from `inbox.md`. Inbox keeps only `status: new` and `status: needs-shaping`.
2. Snapshot `todo-run.md` (the whole file) into `.absol/archive/RUN-{run_id}.md`. Clear `todo-run.md`.
3. Compact `state.md` "Last Session" — keep the most recent 2 sessions in detail, older ones become a one-line summary. Detailed history rolled into `.absol/archive/sessions-{YYYY-MM}.md`.
4. `bugs.md` and `tech-debt.md` get reviewed but **not auto-archived** — the only way to remove a bug or debt item is to fix it (and the fix produces a task) or to ADR it as "won't fix" (and the ADR records why).

**Rule 3 — Tech debt closes the loop through the architect skill.**

Tech debt that never converts into a task isn't really debt — it's noise. The architect skill, when run, includes a debt review pass: pick the top N items in `tech-debt.md`, suggest promoting them into `inbox.md` as actionable tasks, or ADR them as "accepted shape." This keeps `tech-debt.md` from becoming a write-only graveyard.

**Rule 4 — note-taker becomes a router.**

The note-taker no longer writes to `state.md`. Instead it categorises:

- "this is a feature idea" → append to `inbox.md` with `status: new`
- "this is a bug" → append to `bugs.md`
- "this is debt / cleanup" → append to `tech-debt.md`

**Ambiguity default: `inbox.md`.** When the note can't be cleanly categorised, default to `inbox.md` with `status: new`. Over-classifying as a feature is recoverable (triage will reclassify on the next pass); under-classifying loses signal because debt and bug files don't get re-triaged.

Same shower-thought-dump UX. Different output destinations. This keeps `state.md` purely a finalizer-managed truth snapshot.

---

## 7. Carry-forward token optimizations

These were identified in the May 1 plan and are still live. Folded into this overhaul:

- **Agent self-loading.** Orchestrator hands the agent a path to its definition, not the full text. Agent reads its own definition as Step 0. Removes ~12 full definitions per 10-task run from orchestrator context.
- **Collapse orchestrator SKILL.md routing into a table.** ~120 lines of "How to invoke" sub-sections become a 20-line routing table. Saves ~5–8 K tokens per run.
- **Planner pre-tags `executor_tier`.** The planner already knows task complexity. It tags `tier: micro | full` during planning. Orchestrator trusts the tag and routes accordingly. No re-analysis per task.
- **Wider micro-exec criteria.** Drop the TWEAK/CHORE-only restriction. Any low-risk single-file task is micro. Trust the planner's tag.
- **Merge fast-track into executor.** Two tiers, not three: `micro` (inline, no agent) and `full` (executor agent). The fast-track agent definition gets deleted; executor naturally does less work for simpler tasks.
- **Merge triage + planner into a single opus agent.** Triage's classification was always the planner's first step. Merging eliminates one agent spawn and one file round-trip per run.
- **Reviewer receives filtered data.** Orchestrator extracts the relevant `[job]` and `[task]` entries and passes them in the review prompt. Reviewer doesn't parse 15 jobs to find 2 flagged ones.

Estimated combined saving: ~100–130 K tokens per 10-task run.

---

## 8. How the pieces reinforce each other

The overhaul isn't seven independent changes. They're a system:

- **CONTEXT.md feeds shaper, planner, executor.** Same vocabulary everywhere means less re-discovery, less drift, less re-prompting.
- **Vertical slices + TDD pair naturally.** Each slice is a tracer bullet through the stack; TDD's red-green-refactor fits one slice exactly. The skills were written for each other.
- **HITL/AFK + executor_tier together let the orchestrator route work cheaply.** AFK + micro = inline edit, zero agent cost. AFK + full = sonnet executor, no user pause. HITL = pipeline pause, opus reviewer if rejected. The cost gradient matches the risk gradient.
- **ADRs + architect skill close the loop on rejections.** The architect's deepening candidates that get rejected with a real reason become ADRs. The next architect run reads the ADRs first and doesn't re-suggest. This compounds — the more ADRs, the cheaper each architect run becomes.
- **File restructure enables clean archival.** When `.absol/` owns a folder end-to-end, the finalizer's archive pass is a folder operation, not a file edit. Archive policy becomes implementable in ~20 lines of finalizer logic.
- **note-taker as router unblocks state.md cleanup.** State.md only stays clean if nothing dumps shower-thoughts into it. Routing note-taker output to the right files makes state.md genuinely fixable.

---

## 9. Phased rollout

**Phase 0 — Foundations (lowest risk, highest immediate value)**

1. File restructure for *new* projects only — `absol-newproject` writes to `.absol/`.
2. Finalizer expansion — archive `inbox.md` promoted items, snapshot `todo-run.md`, compact `state.md` Last Session.
3. Pull `tech-debt.md` and `bugs.md` out of `state.md` (template change).
4. Token optimizations from §7: agent self-loading, routing table, executor_tier tag, wider micro-exec, merge fast-track into executor, filtered reviewer data.

Existing projects are unchanged. Orchestrate runs work the same; pipeline output is just smaller and tidier.

**Phase 1 — Intake quality**

1. Shaper protocol tightened: 1–3 quick questions, then park.
2. `/grill-me` ported as a standalone skill.
3. Planner adopts vertical-slice rule; rejects horizontal-only tasks.
4. `[task]` schema gains `hitl: yes|no`. Orchestrator pauses for HITL tasks.
5. `plan.md` schema gains `modules`, `testing`, `out_of_scope` sub-fields (PRD fold-in).
6. Merge triage + planner into one opus agent.

**Phase 2 — Execution discipline**

1. Executor adopts TDD red-green-refactor for FEAT and medium+ BUG tasks.
2. note-taker becomes a router (writes to `inbox.md` / `bugs.md` / `tech-debt.md`).
3. CONTEXT.md scaffolded by `absol-newproject`. Every agent reads it at start.
4. `.absol/adr/` scaffolded with `0000-template.md`.

**Phase 3 — Architecture**

1. `absol-architect` skill ported from `improve-codebase-architecture`.
2. Architect's debt-review pass: promote top tech-debt items to inbox, offer ADR for rejected candidates.
3. Absol-itself ADRs documented in `projects/absol/docs/adr/`.

Each phase is independently shippable. Phase N doesn't block Phase N+1, but the ordering reflects "highest leverage to lowest" given current pain points.

---

## 10. Migration

- **Existing projects keep flat layout.** snowowl, huntrx, etc. don't auto-migrate. They keep working under the old conventions.
- **New projects get the new layout** via the updated `absol-newproject` template.
- **Optional later: `absol-update` skill** that walks an existing project and migrates it (`mv inbox.md .absol/inbox.md`, split `state.md` into `bugs.md` / `tech-debt.md`, scaffold `CONTEXT.md` / `adr/`). Defer until at least one project actually wants migration.
- **Skill duplication discipline.** Skills live in two places: `projects/absol/skills/` (source of truth, version-controlled) and `~/.claude/skills/` (deployed copy Claude Code reads). Every overhaul of a skill needs both updated. The current process is manual; worth documenting in absol's README and possibly automating via a sync script.

---

## 11. Resolved decisions

Locked-in answers to the questions raised during planning. All eight are folded into the relevant sections above; this list is the index.

| # | Question | Decision |
|---|---|---|
| 1 | Parking-lot UX | Surface inline in the finalization summary at end of run, and on demand when the user asks status or invokes `/absol-orchestrate`. Never written into `state.md`. (§5 surfacing rule) |
| 2 | `/grill-me` output destination | Always appends to `plan.md` as a shaped item. If the source was an `inbox.md` entry with `status: needs-shaping`, also flips that entry to `status: shaped`. (§3 Track 1) |
| 3 | HITL pause UX | Cluster HITL tasks at the start of the run when dependencies allow, otherwise the end. Prompt presents the full task entry and accepts free-form input — not just y/n. (§3 Track 2) |
| 4 | CONTEXT.md authoring | Lazy-grown by `grill-me`, `architect`, and `note-taker`. Not bootstrapped from `vision.md`. Not user-only. (§4) |
| 5 | ADR drafting | Only the architect skill drafts ADRs, and asks the user to confirm before writing. (§4) |
| 6 | note-taker categorisation default | When ambiguous, default to `inbox.md` with `status: new`. Over-classifying as a feature is recoverable on next triage; under-classifying loses signal. (§6 Rule 4) |
| 7 | Archive retention | Grow forever for now. Revisit after the new pipeline has been used long enough to know what "too much" feels like. (§6) |
| 8 | Git tracking inside `.absol/` | Track `CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`. Ignore `inbox.md`, `plan.md`, `todo.md`, `todo-run.md`, `archive/`. (§5 gitignore policy) |

---

## 12. Out of scope

Explicit non-goals for this overhaul:

- Multi-project orchestration (one orchestrate run touching multiple projects)
- Parallel task execution
- Remote / scheduled / autonomous absol runs
- CI integration (auto-finalize on PR merge, etc.)
- Human-readable dashboards / status pages
- Multi-user features (RBAC, assignment, review approvals)

These are valid future directions but won't be addressed here. Anchoring the overhaul to the current solo, local, interactive workflow keeps the scope honest.
