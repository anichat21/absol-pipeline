# absol-pipeline

A multi-agent workflow pipeline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that handles the full lifecycle of software development tasks — from intake and triage through planning, execution, review, and finalization.

## What it does

Absol decomposes work requests into structured, dependency-aware tasks and executes them through specialized agents. Each agent has a single responsibility and defined inputs/outputs, coordinated by a central orchestrator.

### Full pipeline
```
intake -> shape (if needed) -> triage -> checkpoint -> planner -> batch-builder -> executor -> reviewer -> finalizer
```

### Fast-track pipeline
```
intake -> shape (if needed) -> triage -> checkpoint -> fast-track agent (plan + execute + finalize in one pass)
```

## Architecture

### Skills (entry points)

| Skill | Role |
|-------|------|
| `absol-orchestrate` | Main pipeline coordinator — decides what phase to run, spawns agents, manages flow |
| `absol-batch-builder` | Groups tasks into dependency-aware execution batches (internal) |
| `absol-finalizer` | Updates project state after execution, closes the run (internal) |

### Agents (spawned by orchestrator)

| Agent | Model | Role |
|-------|-------|------|
| `absol-triage` | sonnet | Classifies and routes incoming work requests |
| `absol-shaper` | (inline) | Interactive — shapes vague requests through conversation with the user |
| `absol-planner` | opus | Decomposes work into structured, executable tasks |
| `absol-fast-track` | sonnet | Compressed pipeline for small, low-risk tasks |
| `absol-executor` | sonnet | Executes a single task, writes results |
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
| `inbox.md` | Raw intake items | triage, fast-track |
| `plan.md` | Shaped work items | triage, planner |
| `todo.md` | Execution-ready tasks | planner, fast-track, finalizer (status only) |
| `todo-run.md` | Execution results (job entries) | executor, fast-track |
| `state.md` | Current project truth | finalizer, planner (tech debt), fast-track |
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
- **Checkpoints before major transitions.** The user always gets a decision point after triage (choose pipeline path) and after execution (build/test/finalize).
- **Planning and execution are separate.** The planner (opus) thinks carefully about decomposition. The executor (sonnet) follows instructions precisely. Neither crosses into the other's domain.
- **Fast-track for trivial work.** Small, low-risk tasks skip the full pipeline ceremony. Fast-track can be used at checkpoint time or at runtime for tasks that turn out to be trivial.
- **State is truth, not intent.** The finalizer only records verified outcomes. Failed work is tracked honestly.

## Feedback

See `feedback/` for session retrospectives and improvement notes from real pipeline runs.

## License

MIT
