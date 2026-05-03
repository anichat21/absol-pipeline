---
name: absol-migrate
description: One-shot migration of an existing absol project from the flat layout (all MD files at project root, debt/bugs embedded in state.md) to the new .absol/ layout. Reads the project, presents a kept-vs-dropped plan, only writes on user confirmation. Git is the revert path. Use this skill when the user says '/absol-migrate', 'migrate this project', 'move project to .absol layout', or asks to upgrade an old absol project to the new structure.
---

# absol-migrate

Convert an existing absol project from the flat layout (all MD files in project root) to the `.absol/` layout (`CLAUDE.md`, `state.md`, `vision.md`, `roadmap.md` at root; everything else under `.absol/`).

**Approach: rewrite, not surgical preservation.** Most of an existing project's pipeline state is past — promoted inbox items, old session logs, completed plan entries. Preserving all of that into a `.absol/archive/` graveyard is hoarding. This skill reads, extracts what's durable, scaffolds a clean new layout, and discards the rest. Git is the long-term archive.

This skill is **opt-in and one-shot.** The user runs it once per project when they're ready.

## Invocation

- `/absol-migrate` — auto-detects the project from cwd. Walks upward looking for a `state.md` or `CLAUDE.md`. Bails after 5 levels.
- `/absol-migrate <path>` — operates on the project at the given path.

If auto-detection fails, ask the user for an explicit path. Don't guess.

## Step 1 — Pre-flight checks

Refuse to proceed unless every condition holds. Surface the failure clearly so the user knows what's blocking.

| Check | Pass condition | On fail |
|---|---|---|
| Already migrated | `.absol/` does not exist as a directory | Bail: "project already migrated — `.absol/` exists" |
| Project shape | `state.md` exists at the resolved root | Bail: "doesn't look like an absol project — no state.md" |
| Pipeline idle | `todo-run.md` empty (only header) or absent | Bail: "active run detected — finalize first" |
| Tasks idle | `todo.md` is empty, or all `[task]` entries are `status: done` | Warn; ask for explicit confirmation to proceed |
| Git clean | `git status --porcelain` empty | Surface diff; ask for explicit `--force` confirmation to proceed |
| Non-git project | `.git/` exists | If absent, allow only with explicit `--force` confirmation; warn that revert is manual |

`--force` is asked for interactively when needed — not a CLI flag. Pose it as a yes/no question with the cost ("uncommitted changes detected — proceeding will mix the migration diff with your in-flight work; continue anyway? [y/N]").

## Step 2 — Read & extract

One read pass. Build an in-memory representation of what's durable:

| Source | Action |
|---|---|
| `vision.md` | Keep verbatim |
| `roadmap.md` | Keep verbatim |
| `CLAUDE.md` | Read; identify user-customised sections (Stack table, run commands, Architecture, anything not in the standard newproject template). Discard the auto-generated "Project MD Files" table — it gets regenerated to point at the new paths. |
| `state.md` "Tech Debt" section | Extract body |
| `state.md` "Known Bugs" section | Extract body |
| `state.md` "In Progress" section | Extract body if non-empty |
| `state.md` "Last Session" | Extract only the most recent session entry; compress to one-line summary |
| `state.md` "Planned Features" | Extract — handled interactively in Step 3 |
| `inbox.md` | Keep entries with `status: new` or `status: needs-shaping` only |
| `plan.md` | Keep `[plan-item]` entries that look active (no `status: done`) |
| `todo.md`, `todo-run.md` | Discarded — pre-flight ensured they're empty |

Extraction tolerates missing or non-standard headers. If a section is missing, note it as "not found" and surface in the kept/dropped report so the user notices before approving.

## Step 3 — Surface "Planned Features" (interactive)

If `state.md` has a Planned Features section with items, present them and ask:

```
state.md "Planned Features" section has {N} items:

  1. {item}
  2. {item}
  ...

Promote these to .absol/inbox.md as status: new? [y / n / select]
```

- `y` — all items become `[item]` entries in inbox.md with `status: new`.
- `n` — drop them entirely.
- `select` — ask per-item.

If the section is missing or empty, skip silently.

## Step 4 — Show kept / dropped report

Before writing anything, present a single summary of what the migration will do. The user must approve before any file is touched.

```
Migration plan for {project}:

KEEP (will be written into new layout):
  vision.md            ({n} lines, verbatim)
  roadmap.md           ({n} lines, verbatim)
  CLAUDE.md custom     ({n} lines — Stack table, run commands, Architecture, user edits)
  state.md In Progress ({n} lines)  — into new state.md
  state.md Tech Debt   ({n} lines)  — into .absol/tech-debt.md
  state.md Known Bugs  ({n} lines)  — into .absol/bugs.md
  state.md Last Session — compressed to 1-line summary in new state.md
  inbox.md active items ({n})       — into .absol/inbox.md
  plan.md active entries ({n})      — into .absol/plan.md
  Planned Features ({n})            — promoted to .absol/inbox.md as status: new

DROP (recoverable from git history):
  inbox.md historical items ({n}, all status: promoted)
  state.md Last Session — older entries ({n} lines)
  plan.md completed entries ({n})
  CLAUDE.md auto-generated MD-file-index table (regenerated)

SCAFFOLD (new files):
  .absol/CONTEXT.md            — empty glossary
  .absol/adr/0000-template.md  — ADR template
  .absol/todo.md               — empty
  .absol/todo-run.md           — empty
  .absol/archive/              — empty folder

Apply? [y / n]
```

If `n` — abort cleanly. Nothing has been written; no rollback needed.

If `y` — proceed to Step 5.

If any "not found" notes from Step 2 should appear, list them under a `WARNINGS` block above the prompt so the user can verify nothing they care about was missed.

## Step 5 — Delete superseded root files

Once the user approves: delete from the project root:

- `inbox.md`
- `plan.md`
- `todo.md`
- `todo-run.md`

These are being replaced by the `.absol/` versions. Leaving the originals would cause file-resolution ambiguity — both the legacy path and the new path would exist, and downstream skills would have to disambiguate.

`vision.md`, `roadmap.md`, `state.md`, `CLAUDE.md` stay at root. They're being rewritten in place, not relocated.

## Step 6 — Scaffold `.absol/`

Create the new folder layout populated from the extracted content:

```
.absol/
├── CONTEXT.md          ← empty glossary template (same as newproject)
├── adr/
│   └── 0000-template.md
├── inbox.md            ← active items + promoted Planned Features (Step 3)
├── plan.md             ← active entries
├── todo.md             ← empty header
├── todo-run.md         ← empty header
├── bugs.md             ← from state.md Known Bugs
├── tech-debt.md        ← from state.md Tech Debt
└── archive/            ← empty (used by future finalize runs)
```

Use the same templates as `absol-newproject`'s Step 4 for the empty/skeleton files (`CONTEXT.md`, `adr/0000-template.md`, `todo.md` header, `todo-run.md` header, `archive/`).

For the populated files, lift the extracted content directly. Don't re-format or reorder — surgical preservation only inside the file content. The headings on `bugs.md` and `tech-debt.md` follow the newproject template; the body is the extracted content.

## Step 7 — Rewrite root files

### state.md

Regenerate from the new template (same shape as newproject's state.md):

```markdown
# {Project} — Current State

*Last updated: {date}*

## Last Session

{one-line summary extracted in Step 2}

## In Progress

{extracted In Progress content, or "Nothing." if empty}

## Parked Items

None.
```

The Tech Debt, Known Bugs, and Planned Features sections are **not** in the new state.md — they live in `.absol/tech-debt.md`, `.absol/bugs.md`, and `.absol/inbox.md` respectively.

### CLAUDE.md

Regenerate the standard sections from the newproject template, then splice the user-customised sections (identified in Step 2) into the right places:

- Stack table → replace the template's `Stack` section
- Run commands → replace the template's `How to Run` and `Rebuild & Restart Docker`
- Architecture → replace the template's `Architecture`
- Other user-added sections → append after `Architecture`, before `Project MD Files`

The "Project MD Files" table is regenerated from the newproject template so it points at the new `.absol/` paths. The Wrap-Up Rule is regenerated from the newproject template (it now references the finalizer skill, not a hand-edit flow).

### .gitignore

Append (idempotent — skip lines that already exist):

```
# absol pipeline churn — recovers from finalize, no value in git history
.absol/inbox.md
.absol/plan.md
.absol/todo.md
.absol/todo-run.md
.absol/archive/
```

If the project's existing `.gitignore` already had a line ignoring root-level `inbox.md`, `plan.md`, `todo.md`, or `todo-run.md`, leave those legacy lines in place — they're harmless once those files are gone, and removing them would inflate the diff.

## Step 8 — Final report

Print a short summary so the user can see exactly what changed:

```
Migration complete: {project}

Wrote:
  .absol/ ({n} files)
  state.md  (rewritten — old version in git history)
  CLAUDE.md (rewritten with file-index regenerated; custom sections preserved)
  .gitignore (5 lines appended)

Deleted from root:
  inbox.md, plan.md, todo.md, todo-run.md

Revert:
  git restore .
  git clean -fd .absol/

Diff for review:
  git diff
  git status .absol/
```

## Reversibility

Git only. The pre-flight ensures the repo is clean before starting (or `--force` was given). The migration produces a single coherent diff:

- Modified at root: `state.md`, `CLAUDE.md`, `.gitignore`
- Deleted at root: `inbox.md`, `plan.md`, `todo.md`, `todo-run.md`
- New (untracked): `.absol/` with all its contents

**Revert path** (two commands, project back to flat layout, no residue):

- `git restore .` — restores modified and deleted root files.
- `git clean -fd .absol/` — removes the new untracked folder.

For non-git projects (`--force` was given): the revert is manual — warn loudly in the final report and remind that the operation is irreversible without a backup.

No backup folder. No internal undo log. Git is the right tool for this.

## Out of scope

The migration skill does **not**:

- Preserve historical inbox items, old session logs, or completed plan entries. Git history is where they live.
- Bootstrap `CONTEXT.md` from existing code. It ships empty; lazy growth is the model.
- Promote tech-debt items into actionable inbox tasks. That's `/absol-architect`'s job.
- Run finalizer-style compaction beyond the one-line Last Session summary in Step 2.
- Touch any code files (TypeScript, Python, etc.) or non-absol MD files (e.g. an `assetguide.md` or per-feature design docs that live alongside `state.md`). Files outside the absol set stay where they are.
- Stage or commit anything in git. The diff is left in the working tree for the user to commit deliberately.
- Update deployed copies of any other skill in `~/.claude/skills/`. Sync of `projects/absol/skills/` to `~/.claude/skills/` is a separate concern.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| User rejects the plan in Step 4 | Nothing written yet; clean abort, no rollback |
| Extraction misreads `state.md` (non-standard headers) | Extraction tolerates missing sections; report flags them as "not found" so user notices before approving |
| CLAUDE.md custom sections lost in regeneration | Step 2 identifies them; Step 7 splices them in; Step 4 names them in the kept-list so the user verifies they were caught |
| User has uncommitted unrelated work | Pre-flight refuses without `--force`; surfaces diff so user can stash/commit first |
| Project isn't actually absol-shaped | Pre-flight requires `state.md`; bails otherwise |
| `--force` user reverts but forgets `git clean -fd .absol/` | Final report includes both commands explicitly, on adjacent lines |
| Skill duplication: source + `~/.claude/skills/` copy diverge | Document in absol README; sync helper later |

## Rules

- **Never write before user approves Step 4.** Steps 1–4 are read-only and interactive.
- **Date references use ISO 8601** (YYYY-MM-DD).
- **Don't touch code files.** Migration is a layout operation, not a refactor.
- **Don't auto-commit.** Leave the diff for the user to review and commit deliberately.
- **One project at a time.** No batch mode. Reduces blast radius.
