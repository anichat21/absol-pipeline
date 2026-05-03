# absol-pipeline

A multi-agent workflow pipeline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that handles the full lifecycle of software development tasks — from intake through shape, plan, execute (with HITL pauses), review, and finalize.

## What it does

Absol decomposes work requests into structured, dependency-aware tasks and executes them serially through specialised agents. Each agent has a single responsibility; a central orchestrator coordinates them.

```
intake → shape (light, 1–3 q) → plan (subsumes triage) → checkpoint
       → serial execution loop (pauses at HITL tasks) → review (if needed) → finalize
```

Three sibling skills are user-invoked outside the pipeline: `/grill-me` (deep relentless interview into a single shaped item), `/absol-architect` (architecture review pass), `/absol-newproject` (scaffold a new project), `/absol-migrate` (move a flat-layout project to the `.absol/` layout).

## Project layout

Every absol project uses the `.absol/` layout:

```
my-app/
├── CLAUDE.md            ← project meta (root)
├── state.md             ← truth snapshot (root, finalizer-owned)
├── vision.md            ← product intent (root)
├── roadmap.md           ← milestones (root)
└── .absol/              ← pipeline-owned, hidden
    ├── CONTEXT.md       ← domain glossary; every agent reads this
    ├── adr/             ← Architecture Decision Records
    ├── inbox.md         ← active intake          (gitignored)
    ├── plan.md          ← shaped items           (gitignored)
    ├── todo.md          ← executable tasks       (gitignored)
    ├── todo-run.md      ← live execution log     (gitignored)
    ├── bugs.md          ← known bugs             (tracked)
    ├── tech-debt.md     ← known debt             (tracked)
    └── archive/         ← finalizer snapshots    (gitignored)
```

`.gitignore` tracks the durable / decision-bearing files (`CONTEXT.md`, `bugs.md`, `tech-debt.md`, `adr/`) and ignores the churn (`inbox.md`, `plan.md`, `todo.md`, `todo-run.md`, `archive/`).

Legacy projects on the flat layout (everything at root) keep working — every skill detects layout and falls back. Run `/absol-migrate` to upgrade.

## Pipeline flow

```
User provides work request(s)
            |
            v
+-----------------------+
|     ORCHESTRATOR      |  Reads project files, detects current phase
|   (always running)    |  Generates run_id (RUN-YYYY-MM-DD)
+-----------+-----------+  If "continue" -> skip to wherever we left off
            |
            v
      +-------------+     Vague request detected?
      |   SHAPER    |     Inline (interactive). Strict 1–3 question budget.
      |  (inline)   |     Unresolved items park in inbox as needs-shaping.
      +------+------+     Clear requests skip this entirely.
             |
             v
      +-------------+
      |   PLANNER   |     Spawned agent (opus). Subsumes the old triage step.
      |  (agent)    |     Reads inbox/plan/state/CONTEXT.md/ADRs/source code.
      +------+------+     Writes inbox.md + plan.md (triage) + todo.md (tasks).
             |             Tags every task: hitl, executor_tier, execution_order.
             |             Enforces vertical-slice rule.
             v
+---------------------------------------+
|         CHECKPOINT                    |
|  HITL cluster + AFK cluster shown.    |
|  Proceed? [y / n / adjust]            |
+-------------------+-------------------+
                    |
                    v
========================================
       SERIAL EXECUTION LOOP
========================================
    For each task in execution_order:

    hitl: yes  -> orchestrator pauses, presents full task entry,
                  accepts free-form input (approve / reject / amend / pivot).
    hitl: no   -> run unattended.

    Then by executor_tier:
      micro -> orchestrator does it inline (worker: inline).
      full  -> spawn absol-executor (sonnet). TDD red-green-refactor for
               FEAT and medium+ BUG; direct edit for TWEAK / CHORE.

    Each task writes a [job] to todo-run.md.

========================================
       REVIEW (if needed)
========================================
    Orchestrator filters todo-run.md for review_flag/failed/needs-review,
    passes the filtered jobs + matching tasks to the reviewer.

    Routine        -> absol-reviewer (sonnet)
    ARCH/high/deep -> absol-reviewer-complex (opus)

    Verdicts feed the next planning cycle as fix tasks.

========================================
       FINALIZATION CHECKPOINT (mandatory)
========================================
    Run absol-finalizer (skill, inline):
      - update state.md, compact older sessions
      - snapshot promoted inbox items into .absol/archive/
      - snapshot todo-run.md into .absol/archive/RUN-{run_id}.md
      - clear todo-run.md, purge done todo/plan items
      - surface parked needs-shaping items in the summary
```

## Architecture

### Skills

| Skill | Role |
|---|---|
| `absol-orchestrate` | Main pipeline coordinator. Decides phase, spawns agents, manages flow. |
| `absol-finalizer` | Closes the run: state.md, archive snapshots, todo cleanup. (Internal — invoked by orchestrate.) |
| `absol-newproject` | Scaffolds a new project with the `.absol/` layout, Docker, gitignore, git init. |
| `absol-migrate` | One-shot migration of an existing flat-layout project to `.absol/`. |
| `absol-architect` | Standalone architecture review pass. Surfaces deepening candidates, drafts ADRs, reviews tech-debt. Writes ARCH items back to inbox. |
| `grill-me` | Standalone relentless interview on a single idea. Outputs a shaped plan-item. |
| `note-taker` | Routes shower-thought notes to bugs.md / tech-debt.md / inbox.md. |

### Pipeline agents (spawned by orchestrate)

| Agent | Model | Role |
|---|---|---|
| `absol-shaper` | (inline) | Interactive light shaper. 1–3 questions per item; parks the rest. |
| `absol-planner` | opus | Triage + integration analysis + decomposition into vertical-slice tasks. Tags hitl, executor_tier, execution_order. |
| `absol-executor` | sonnet | Single-task executor. TDD for FEAT / medium+ BUG; direct edit otherwise. Also runs as `inline` for `executor_tier: micro` tasks. |
| `absol-reviewer` | sonnet | Routine reviews on filtered jobs. |
| `absol-reviewer-complex` | opus | Deep reviews on filtered jobs (ARCH, high-risk, complex). |

Triage and fast-track are no longer separate agents — triage merged into the planner; fast-track merged into the executor as the `micro` tier.

## Model selection

**Default: sonnet.** All skills run in your session model (sonnet by default). Two skills are heavy enough to recommend switching to opus first; two pipeline agents are pinned to opus regardless.

| Component | Where | Model |
|---|---|---|
| `absol-orchestrate` | skill (your session) | sonnet |
| `absol-shaper` | inline in orchestrate | sonnet |
| `absol-executor` (micro) | inline in orchestrate | sonnet |
| `absol-finalizer` | skill (inline) | sonnet |
| `absol-newproject`, `absol-migrate`, `note-taker` | skill (your session) | sonnet |
| `absol-planner` | spawned agent | **opus** (pinned) |
| `absol-executor` (full) | spawned agent | **sonnet** (pinned) |
| `absol-reviewer` | spawned agent | **sonnet** (pinned) |
| `absol-reviewer-complex` | spawned agent | **opus** (pinned) |
| `grill-me` | skill (your session) | **switch to opus before invoking** |
| `absol-architect` | skill (your session) | **switch to opus before invoking** |

The orchestrator delegates cognitively heavy pipeline steps (decomposition, deep review) to opus agents automatically — you don't have to switch sessions to run `/absol-orchestrate`. Only `/grill-me` and `/absol-architect` need an opus session, since they run as user-invoked skills (no agent spawn).

## Project file structure

| File | Purpose | Owner |
|---|---|---|
| `state.md` (root) | Truth snapshot — last session, in progress, parked items. | finalizer |
| `vision.md`, `roadmap.md` (root) | Product framing. | user |
| `CLAUDE.md` (root) | Project meta, stack, run commands. | user (newproject seeds it) |
| `.absol/CONTEXT.md` | Domain glossary; every agent reads it. | grill-me, architect, note-taker, user |
| `.absol/adr/` | Decision records. | architect (only writer); user can edit |
| `.absol/inbox.md` | Active intake. Items: `new`, `needs-shaping`, `shaped`, `promoted`. | shaper, planner, grill-me, architect, note-taker |
| `.absol/plan.md` | Shaped items with `modules` / `testing` / `out_of_scope` sub-fields. | planner, grill-me |
| `.absol/todo.md` | Tasks with `hitl`, `executor_tier`, `execution_order`. | planner (write), finalizer (status updates only) |
| `.absol/todo-run.md` | Live `[job]` entries during a run. | executor, orchestrator (micro), finalizer (clear) |
| `.absol/bugs.md` | Known bugs. Removed only by fix-and-task or by ADR. | note-taker, architect, user |
| `.absol/tech-debt.md` | Known debt. Removed only by architect (promote or ADR). | note-taker, architect, user |
| `.absol/archive/` | Finalizer snapshots: `inbox-{run}.md`, `RUN-{run}.md`, `sessions-{YYYY-MM}.md`. | finalizer |

Schemas for all file formats live in `skills/absol-orchestrate/references/schemas.md`.

## Installation

Copy the skill directories into your Claude Code skills folder:

```bash
cp -r skills/* ~/.claude/skills/
```

The deployed copy in `~/.claude/skills/` is what Claude Code reads at runtime; `skills/` in this repo is the source of truth. Re-copy after every change. (A sync helper script is on the to-do list.)

## Usage

```
/absol-orchestrate            # main pipeline; describe your work or just say "continue"
/absol-newproject             # scaffold a new project
/absol-migrate                # upgrade an old flat-layout project to .absol/
/grill-me                     # deep interview on one idea; outputs a shaped plan-item
/absol-architect              # architecture review; writes ARCH items back to inbox
```

`note-taker` triggers on phrases like "note that…", "add a bug…", "log this as tech debt".

## Key design decisions

- **Agents self-load.** The orchestrator sends a path to the agent's definition; the agent reads it as Step 0. Saves ~12 full definitions per 10-task run from orchestrator context.
- **CONTEXT.md is the cheapest consistency lever.** Every agent reads it at start of run; everyone uses the same word for the same thing. No more "controls" / "settings" / "toggles" drift across phases.
- **ADRs close the loop on rejections.** Only `/absol-architect` writes ADRs. The next architect run reads them first and doesn't re-suggest. Compounds — the more ADRs, the cheaper each architect run.
- **HITL clusters at run boundaries.** The user sits through HITL pauses up front (or at end), then walks away while the AFK tail runs. Pipeline stays unattended-friendly.
- **Vertical-slice rule in the planner.** Every `[task]` is a tracer bullet through every layer it touches. No "rewrite all schemas first" tasks that fail late.
- **TDD in the executor for FEAT / medium+ BUG.** Red-green-refactor, vertically. Horizontal TDD (write all tests, then all code) is rejected. Tests describe behaviour at the public interface, not implementation.
- **State is truth, not intent.** The finalizer records only verified outcomes. Failed work is tracked honestly. Older session detail compacts to one line; full history goes to monthly archive files.
- **Information surfacing.** The user shouldn't have to open inbox/bugs/tech-debt to know what's going on. The orchestrator (and the finalize summary) surface that information once, in the right place. Files are durable backups, not the primary interface.
- **Pipeline owns one folder end-to-end.** `.absol/` is hidden, gitignored where it churns, tracked where it's durable. Archive becomes a folder operation; the finalizer's job is simpler.
- **Note-taker is a router, not a state-file editor.** Bugs go to bugs.md, debt to tech-debt.md, anything else to inbox. State.md stays a clean truth snapshot.

## Feedback

See `feedback/` for plans, retrospectives, and improvement notes.

## License

MIT
