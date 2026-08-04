# absol-pipeline

> **Migrated 2026-08-04, repo frozen.** Absol now lives at
> [anichat21/Absol](https://github.com/anichat21/Absol) — one repo merging this pipeline with
> ArcticTern (`skills/` + `cli/` + `arctic-tern/`). This repo is the pre-merge history archive;
> swept-feedback and sweep-commit records up to the merge live here.

A project workflow for [Claude Code](https://docs.anthropic.com/en/docs/claude-code): ideas go
in as **ledger items**, work comes out as verified, archived **runs**. The human decides during
shaping; runs execute unattended (AFK and scheduled runs included).

## Design principle

**Store only what can't be recomputed — human decisions and outcomes. Derive or regenerate
everything else.** No status flags, no state syncing, no healing passes: an item is "planned"
because a plan block exists on it; a run is "live" because `run.md` exists (its mtime is the
heartbeat); history is an append-only monthly archive. One fact, one home — every schema lives
in `skills/absol/references/schemas.md` and nowhere else.

## The ladder

An item is born in the ledger (`.absol/inbox.md` / `bugs.md` / `tech-debt.md`) and grows in
place — it never moves, never flips status:

```
capture ──► shape ──► ready ──► RUN ──► archive
note-taker  shaper    (primed)  the execute gate auto-fills what's missing
            (human    map: research (auto) · plan: planner (auto)
            decisions;             ↓
            the only    execute serially → review flagged → verify honestly → finalize
            block that  (unit / runtime probe / owed-to-human VERIFY item)
            needs you)
```

**The execute gate**: "run BUG-014 INBOX-021" checks each item for shape/map/plan and fills
the gaps on the way through. Only shaping can require the user — so AFK and scheduled runs
skip-and-report ambiguous unshaped items instead of guessing. Plan staleness is mechanical:
`git log --since=<planned date>` on each task's files; only moved code gets re-mapped/amended.

## Front door

`/absol <project>` opens a session, recovers crashed/paused runs (live/paused/crashed matrix
in the front door — liveness is run.md's mtime), prints a derived banner, and routes:
**note-taker** (capturing), **scratchpad** (explicit "quick fix"/"let's build it here" —
interactive, same event model), or a **run** (default for action requests). Scheduling: the
front door uses the `schedule` skill to fire the same run headless in AFK mode.

## Components

| Piece | Kind | Job |
|---|---|---|
| absol | skill | front door: open, recover, banner, route, schedule |
| note-taker | skill | capture items; transcribe decisions onto shape blocks |
| absol-shaper | skill | settle intent + the refuse-boundary; strict no-filler question contract |
| absol-research | skill | fan-out blast-radius mapping → `map:` blocks |
| absol-orchestrate | skill (internal) | the run engine: gate → execute → review → close |
| absol-planner | agent | design the build → `plan:` block (simplicity gate, reality-contact first, falsify-before-fix) |
| absol-executor | agent | one task: TDD or direct edit; honest verification |
| absol-reviewer | agent | flagged tasks; fix-required re-executes in-run |
| absol-finalizer | agent | close a run: archive, fold ledger, state.md, delete run.md |
| absol-architect | skill | interactive deepening pass → shaped ARCH items; owns ADRs |
| absol-megareview | skill | unattended deep review → `.absol/reviews/` report + pointer item |
| absol-scratchpad | skill | interactive mode on the same run/event model |
| absol-explain | skill | one-minute orientation |
| absol-feedback | skill | log problems with absol itself → `feedback/YYYYMMDD-NNN-title.md` |
| absol-codex | skill | interface to Codex CLI (safety contract, brief compilation, invocation) — routing lives in `meta/model-doctrine.md` |
| absol-newproject / absol-migrate | skills | scaffold / schema upgrades; owner reference: [knowledge_base/absol](../../knowledge_base/absol/docs/index.html) |

Agents carry no pinned models — they inherit the session; routing follows
`meta/model-doctrine.md`. Event records carry roles (`worker: executor`), never model names.
Build ethos and conduct (reuse ladder, read hygiene, honest verification, question contract)
live in `skills/absol/references/doctrine.md` and bind every component.

Pipeline runs are bracketed by commits when the project has git: `absol: pre-run {run_id}
snapshot` before execution (the rollback anchor) and `absol: {run_id} — n done, n failed` at
finalize. absol never pushes. Failed tasks re-aim instead of patching (the planner's retry
protocol; two retries, then a recorded `smell:` on the item). Every code-changing run ends
with a whole-diff seam review. AFK runs end the turn completely — open questions land on
items as `open:`, and the next session's banner surfaces everything.

## Project layout

```
my-app/
├── CLAUDE.md            brief, stack, ## Pipeline Commands, ## Shipping & Git   user-owned
├── state.md             snapshot: Last Session, Open Threads               finalizer-owned
├── docs/                working/published docs (ArcticTern-discovered HTML or Markdown; no registry)
├── references/          source material the project consumes (PDFs, corpora, study mds)
└── .absol/
    ├── CONTEXT.md  adr/                        knowledge (shaper/architect grown)
    ├── inbox.md  bugs.md  tech-debt.md         the ledger — items grow in place
    ├── archive/YYYY-MM.md                      append-only outcomes
    ├── reviews/                                review & research artifacts
    └── run.md                                  transient; exists ⇔ run live   (gitignored)
```

Everything is git-tracked except `run.md` — the ledger carries shaped human decisions, so it
*is* the durable record.

## Install

Symlink `skills/*` into `~/.claude/skills/` and `agents/*.md` into `~/.claude/agents/`.

## Working on this repo

`CLAUDE.md` anchors the repo's own working system (no `.absol/` here). Authoring principles
for skills and agents: `meta/authoring.md` — read it before editing them.

## Feedback

`feedback/` holds dated problem reports about absol's own behaviour (`absol-feedback` writes
them from any project, mid-anything). The folder is swept when working on absol itself:
applied notes are deleted (git history is the record).
