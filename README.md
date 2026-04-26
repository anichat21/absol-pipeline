# absol-pipeline

A multi-agent workflow pipeline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that handles the full lifecycle of software development tasks — from intake and triage through planning, execution, review, and finalization.

## What it does

Absol decomposes work requests into structured, dependency-aware tasks and executes them serially through specialized agents. Each agent has a single responsibility and defined inputs/outputs, coordinated by a central orchestrator.

```
intake → shape (if needed) → triage → planner → checkpoint → serial execution loop → reviewer (if needed) → finalizer
```

## Pipeline flow

```
User provides work request(s)
            |
            v
+-----------------------+
|     ORCHESTRATOR      |  Reads all project files, detects current phase
|   (always running)    |  Generates run_id (RUN-YYYY-MM-DD)
+-----------+-----------+  If "continue" -> skip to wherever we left off
            |
            v
      +-------------+     Vague requests detected?
      |   SHAPER    |     Runs inline (needs user conversation)
      |  (inline)   |     Outputs shaped requests
      +------+------+     Clear requests skip this entirely
             |
             v
      +-------------+
      |   TRIAGE    |     Spawned agent (sonnet)
      |  (agent)    |     Classifies, deduplicates
      +------+------+     Writes inbox.md + plan.md
             |             Returns triage summary
             v
      +-------------+
      |   PLANNER   |     Spawned agent (opus)
      |  (agent)    |     Reads plan.md, inbox.md, state.md, source code
      +------+------+     Writes todo.md with [task] entries
             |             Each task has execution_order: N
             v
+---------------------------------------+
|         CHECKPOINT                    |
|                                       |
|  Found {N} tasks after planning:      |
|  1. Fix auth bug - BUG, low risk      |
|  2. Add settings page - FEATURE, med  |
|  3. Rename env vars - CHORE, low      |
|                                       |
|  Proceed? [y / n / adjust]            |
+-------------------+-------------------+
                    |
                    |  User says y
                    v

========================================
       SERIAL EXECUTION LOOP
       (orchestrator drives this)
========================================

    todo.md has tasks ordered 1..N
    Orchestrator walks them one at a time:

    +----------------------------------+
    |  TASK 1/N                        |
    |  Read task -> pick executor tier |
    +----------+-----------------------+
               |
               +--- Low risk + single file + obvious + TWEAK/CHORE?
               |         |
               |         v
               |    +--------------+
               |    | MICRO-EXEC   |  Orchestrator does it inline
               |    | (inline)     |  No agent spawn
               |    +------+-------+  worker: inline
               |           |
               +--- Low risk + no deps + simple BUG/TWEAK/CHORE?
               |         |
               |         v
               |    +--------------+
               |    | FAST-TRACK   |  Spawned agent (sonnet)
               |    | (agent)      |  Lighter protocol
               |    +------+-------+  worker: sonnet
               |           |
               +--- Everything else
                         |
                         v
                    +--------------+
                    |  EXECUTOR    |  Spawned agent (sonnet)
                    |  (agent)     |  Full protocol: read, execute,
                    +------+-------+  verify, write [job] to todo-run.md
                           |
               +-----------+-----------+
               |                       |
            success                 failed/blocked
               |                       |
               v                       v
    "Task 1/N complete"         STOP. Report failure.
    Write [job] to todo-run.md  User decides: retry, skip, abort.
               |
               v
         next task...
               |
              ...
               |
               v
    +----------------------+
    |  ALL TASKS COMPLETE  |
    +----------+-----------+
               |
               v

========================================
       REVIEW (if needed)
========================================

    Orchestrator scans todo-run.md for:
      review_flag: yes
      status: failed
      status: needs-review

    None found?  --> Skip to finalization checkpoint
         |
    Found some?
         |
         +--- ARCH / high-risk / complex?
         |         |
         |         v
         |    +--------------------+
         |    | REVIEWER-COMPLEX   |  Spawned agent (opus)
         |    | (agent)            |  Deep architectural review
         |    +--------+-----------+
         |             |
         +--- Routine flagged work
                       |
                       v
              +--------------+
              |  REVIEWER    |  Spawned agent (sonnet)
              |  (agent)     |  Standard review
              +------+-------+
                     |
                     v
              Review verdicts written
              fix-required -> new tasks next cycle
              approved -> ready for finalization
              human-check -> flagged to user
                     |
                     v

+---------------------------------------+
|       FINALIZATION CHECKPOINT         |
|                                       |
|  Run: {run_id}                        |
|  Execution complete. 5/5 done.        |
|                                       |
|  Files modified:                      |
|  - src/auth.ts                        |
|  - src/pages/Settings.tsx             |
|  - .env.example                       |
|                                       |
|  Build & test? [y / skip]             |
|  Finalize?     [y / n]               |
+-------------------+-------------------+
                    |
                    |  User says y
                    v
             +-------------+
             |  FINALIZER  |  Runs inline as skill
             |  (inline)   |  Updates state.md with verified outcomes
             +------+------+  Updates todo.md statuses (done/failed)
                    |          Clears resolved jobs from todo-run.md
                    v
             +-------------+
             |    DONE     |  Summary reported to user
             +-------------+


========================================
       EXECUTOR TIER CRITERIA
========================================

    MICRO-EXEC (inline, no agent spawn)
    +- risk: low
    +- touches 1 file
    +- type: TWEAK or CHORE
    +- description is unambiguous
    +- no verification beyond build check

    FAST-TRACK (agent, lighter protocol)
    +- risk: low
    +- all dependencies satisfied
    +- type: TWEAK, CHORE, or low-risk BUG
    +- no design decisions needed

    FULL EXECUTOR (agent, full protocol)
    +- everything else


========================================
       RESUME LOGIC
========================================

    User says "continue" or "keep going":

    Orchestrator reads project files and detects:

    +- todo-run.md has jobs with current run_id
    |  but todo.md has remaining pending tasks
    |       -> resume execution loop from next task
    |
    +- todo-run.md has jobs with review flags
    |       -> enter review phase
    |
    +- todo-run.md has resolved jobs, state.md not updated
    |       -> enter finalization
    |
    +- plan.md/inbox.md has new items, no todo.md tasks
    |       -> enter planner
    |
    +- todo-run.md has stale run_id (old session)
    |       -> warn user, offer to finalize old run first
    |
    +- everything clean
         -> report "nothing to do"
```

## Architecture

### Skills (entry points)

| Skill | Role |
|-------|------|
| `absol-orchestrate` | Main pipeline coordinator — decides what phase to run, spawns agents, manages flow |
| `absol-finalizer` | Updates project state after execution, closes the run (internal) |

### Agents (spawned by orchestrator)

| Agent | Model | Role |
|-------|-------|------|
| `absol-triage` | sonnet | Classifies and routes incoming work requests |
| `absol-shaper` | (inline) | Interactive — shapes vague requests through conversation with the user |
| `absol-planner` | opus | Decomposes work into structured, executable tasks with execution order |
| `absol-fast-track` | sonnet | Lighter executor for simple, low-risk tasks |
| `absol-executor` | sonnet | Executes a single task with full protocol |
| `absol-reviewer` | sonnet | Reviews routine flagged work |
| `absol-reviewer-complex` | opus | Reviews complex, high-risk, or architectural work |

### Supporting skills

| Skill | Role |
|-------|------|
| `todo-executor` | Executes todos serially from todo.md (standalone, outside pipeline) |
| `todo-maker` | Generates todo.md from plan.md (standalone) |
| `todo-reviewer` | Verifies todo-executor output (standalone) |
| `note-taker` | Records bugs, tech debt, and planned features to state.md |

## Project file structure

The pipeline reads and writes structured markdown files in each project directory:

| File | Purpose | Written by |
|------|---------|------------|
| `inbox.md` | Raw intake items | triage |
| `plan.md` | Shaped work items | triage, planner |
| `todo.md` | Execution-ready tasks | planner (create), finalizer (status only) |
| `todo-run.md` | Execution results (job entries) | executor, fast-track, micro-exec |
| `state.md` | Current project truth | finalizer, planner (tech debt) |
| `vision.md` | Product intent | user (read-only by pipeline) |
| `roadmap.md` | Strategic milestones | user (read-only by pipeline) |

Schemas for all file formats are defined in `skills/absol-orchestrate/references/schemas.md`.

## Installation

Copy the skill directories into your Claude Code skills folder:

```bash
cp -r skills/* ~/.claude/skills/
```

## Usage

Invoke the pipeline through Claude Code:

```
/absol-orchestrate
```

Or just describe your work and say "run the pipeline", "orchestrate this", or "process this through absol".

## Key design decisions

- **Agents are spawned, not inlined.** Every agent component runs as a proper subagent via the Agent tool. This preserves context isolation, enforces tool restrictions, and keeps the orchestrator lean.
- **Checkpoints before major transitions.** The user always gets a decision point after planning (approve task list) and after execution (build/test/finalize).
- **Planning and execution are separate.** The planner (opus) thinks carefully about decomposition and ordering. The executor (sonnet) follows instructions precisely. Neither crosses into the other's domain.
- **Serial execution.** One task at a time, always. No parallel writes, no ID races, no merge conflicts. Three executor tiers (micro, fast-track, full) keep overhead proportional to task complexity.
- **State is truth, not intent.** The finalizer only records verified outcomes. Failed work is tracked honestly.
- **Run IDs tie sessions together.** Every job entry carries a run_id, enabling clean resume detection and preventing cross-session contamination.

## Feedback

See `feedback/` for session retrospectives and improvement notes from real pipeline runs.

## License

MIT
