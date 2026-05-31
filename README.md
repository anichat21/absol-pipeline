# absol-pipeline

A multi-agent workflow pipeline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that handles the full lifecycle of a software task — intake → shape → plan → execute → review → finalize. The human decides during **shaping**; the pipeline then runs **unattended**. Each agent has one job; a central orchestrator coordinates them.

## Front door

**`/absol` is the only entry point.** It opens a session on a project, runs crash/pause recovery if needed, prints a status banner, then watches the conversation and routes to one of three modes:

| Mode | Trigger | What happens |
|---|---|---|
| **note-taker** | "note that…", "add a bug…", "log this as debt" | Routes the note to `inbox.md` / `bugs.md` / `tech-debt.md` |
| **scratchpad** | explicit "scratchpad" / "quick fix" / "real quick" / "adhoc" | Inline adhoc work or a discussion, no formal plan |
| **pipeline** | everything else — "do the bugs", "build X", "let's churn" | Plan (planner) → execute (orchestrate) → finalize |

Pipeline is the default for any action request; scratchpad needs an explicit signal.

## Pipeline flow

```
/absol → shape (light, optional) → plan → checkpoint
       → serial execution loop (unattended) → review (if needed) → finalize
```

- **Shape** (`absol-shaper`, inline) — 1–3 intent questions, recommended answers, reads code instead of asking when it can. This is the sole decision point: every consequential call is settled here so execution runs unattended. Invoked by the planner when intent is ambiguous, or standalone.
- **Plan** (`absol-planner`, opus agent) — reads inbox/bugs/tech-debt + state + CONTEXT.md + ADRs + source, decomposes into **self-contained, actionable** vertical-slice tasks (the description carries the approach + entry points + constraints so the executor doesn't re-research), tags each with `executor_tier` / `execution_order`, writes one `PLAN-NNN` to `plan.md`.
- **Execute** (`absol-orchestrate`, internal) — copies the plan's tasks into `run-active.md` and runs them serially, **unattended** — no mid-run pauses; decisions were settled in shaping. Verification failures enter a test-fail auto-loop (re-plan → re-execute, capped); only a post-retry failure or a manual pause interrupts. Each task appends `[event]` blocks to `run-active.md`.
- **Review** (`absol-reviewer` sonnet / `absol-reviewer-complex` opus) — only on flagged/failed tasks. Verdicts feed the next planning cycle.
- **Finalize** (`absol-finalizer`, internal, mandatory) — runs verify/smoke, writes a lean **outcome-only** `archive/run-{run_id}.md` (one line per task), updates `state.md` as a truth snapshot, prunes done plans/notes, and rolls run archives older than the current month into `archive/runs-{YYYY-MM}.md`.

## Project layout

```
my-app/
├── CLAUDE.md            ← project meta, stack, run commands (root, user-owned)
├── state.md             ← truth snapshot (root, finalizer-owned)
├── vision.md            ← product intent (root, user-owned)
├── roadmap.md           ← milestones (root, user-owned)
└── .absol/              ← pipeline-owned, hidden
    ├── CONTEXT.md       ← domain glossary; every agent reads this   (tracked)
    ├── adr/             ← Architecture Decision Records             (tracked)
    ├── bugs.md          ← known bugs, BUG-NNN [note]s               (tracked)
    ├── tech-debt.md     ← known debt, DEBT-NNN [note]s              (tracked)
    ├── archive/         ← finalizer run history (lean, rolled up)   (tracked)
    ├── inbox.md         ← feature/idea intake, INBOX-NNN [note]s    (gitignored)
    ├── plan.md          ← active PLAN-NNN queue, per-run            (gitignored)
    └── run-active.md    ← live run event log (created per run)      (gitignored)
```

`.gitignore` tracks the durable files — `CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`, and `archive/` (the run history, so it has a git safety net) — and ignores only the per-run churn the pipeline regenerates (`inbox.md`, `plan.md`, `run-active.md`).

## Files

| File | Purpose | Owner |
|---|---|---|
| `state.md` (root) | Truth snapshot — last session, in progress, parked items, transient run sections. | finalizer (+ orchestrator for run sections) |
| `vision.md`, `roadmap.md`, `CLAUDE.md` (root) | Product framing, stack, run commands. | user |
| `.absol/CONTEXT.md` | Domain glossary; every agent reads it. | shaper, architect, note-taker, user |
| `.absol/adr/` | Decision records. | architect (writer); user can edit |
| `.absol/inbox.md` `bugs.md` `tech-debt.md` | Unified `[note]` intake (`status: new` → `promoted`). | note-taker (writes), planner/architect (promote), finalizer (prune) |
| `.absol/plan.md` | `PLAN-NNN` queue with seeds + execution tasks. Per-run; never accumulates. | planner, architect |
| `.absol/run-active.md` | Live run: header + task snapshot (orchestrator-owned) + appended `[event]`s (agents). | orchestrator (header/snapshot), executor/reviewer (append) |
| `.absol/archive/` | Lean run history: `run-{run_id}.md` (current month), `runs-{YYYY-MM}.md` + `sessions-{YYYY-MM}.md` (older, rolled up). Tracked. | finalizer |

Schemas for every file format live in `skills/absol-orchestrate/references/schemas.md`.

## Components

### Skills

| Skill | Role |
|---|---|
| `absol` | **Front door.** Recovery, status banner, mode routing. The only supported entry point. |
| `absol-orchestrate` | *(internal)* Execution engine. Runs the plan's tasks serially and unattended, manages the test-fail loop / review, hands off to finalizer. |
| `absol-finalizer` | *(internal)* Closes a run: state.md, archive snapshots, plan/note pruning. |
| `absol-scratchpad` | Adhoc execution or pure-discussion mode outside the formal pipeline. |
| `absol-shaper` | Light interactive shaping (intent only). Inline in the pipeline or standalone. |
| `absol-architect` | Standalone architecture review. Surfaces deepening candidates, drafts ADRs, writes refactor `PLAN-NNN`s. |
| `absol-newproject` | Scaffolds a new project with the `.absol/` layout, Docker, gitignore, git init. |
| `absol-migrate` | Reusable shell to migrate a project to the current schema after a release that changes file shapes. |
| `note-taker` | Routes notes to `bugs.md` / `tech-debt.md` / `inbox.md`. |

### Agents

| Agent | Model | Role |
|---|---|---|
| `absol-planner` | **opus** | Triage + decomposition into vertical-slice tasks. (`~/.claude/agents/absol-planner.md`.) |
| `absol-executor` | sonnet | Single-task executor. TDD for FEAT / medium+ BUG; direct edit otherwise. Also runs inline for `micro` tasks. |
| `absol-reviewer` | sonnet | Routine reviews on flagged tasks. |
| `absol-reviewer-complex` | opus | Deep reviews (ARCH, high-risk, complex). |

`absol-planner` is deployed top-level to `~/.claude/agents/`; the executor/reviewer definitions live under `skills/absol-orchestrate/agents/`.

## Model selection

Default is your session model (sonnet). The planner and complex-reviewer agents are pinned to **opus** regardless, so you don't need to switch sessions to run the pipeline. `absol-architect` is heavy enough that an opus session is recommended before invoking it.

## Installation

`~/.claude/skills/` and `~/.claude/agents/` are **symlinked** to this repo, so edits here are live immediately — there is no copy/sync step. To set up on a fresh machine, symlink each skill directory plus the planner agent:

```bash
for d in skills/*/; do ln -sfn "$PWD/$d" ~/.claude/skills/"$(basename "$d")"; done
ln -sfn "$PWD/agents/absol-planner.md" ~/.claude/agents/absol-planner.md
```

(The executor/reviewer agent definitions live under `skills/absol-orchestrate/agents/` and resolve through the orchestrate symlink — they don't need their own top-level link.)

## Usage

```
/absol [project]   # the front door — describe your work, or say "continue"
/absol-architect   # architecture review; writes ADRs + refactor plans
/absol-newproject  # scaffold a new project
/absol-migrate     # upgrade a project's schema after a release
```

`note-taker`, `absol-shaper`, `absol-orchestrate`, and `absol-finalizer` are invoked through `/absol` rather than directly.

## Key design decisions

- **Agents self-load.** The orchestrator passes a path to each agent's definition; the agent reads it as Step 0. Saves loading a dozen full definitions into orchestrator context per run.
- **`run-active.md` is append-only.** The orchestrator owns the header + task snapshot; agents only append `[event]`s. Crash recovery is trivial — the file's existence plus `last_event_at` tell `/absol` whether a run is live, paused, or crashed.
- **CONTEXT.md is the cheapest consistency lever.** Every agent reads it at start of run, so everyone uses the same word for the same thing.
- **ADRs close the loop on rejections.** Only `absol-architect` writes them; the next architect run reads them first and doesn't re-suggest. The more ADRs, the cheaper each run.
- **Decisions front-load into shaping; the pipeline runs unattended.** There are no mid-run human gates — every consequential call is settled while the user is engaged in shaping. Only a genuine failure (after retries) or a reviewer's `human-check` surfaces afterward.
- **Vertical-slice rule in the planner.** Every task is a tracer bullet through every layer it touches. No "rewrite all schemas first" tasks that fail late.
- **State is truth, not intent.** The finalizer records only verified outcomes; failed work is tracked honestly. Old session detail compacts to one line; full history goes to monthly archive files.
- **Pipeline owns one folder end-to-end.** `.absol/` is hidden, gitignored where it churns, tracked where it's durable.

## Feedback

See `feedback/` for retrospectives and improvement notes.

## License

MIT
