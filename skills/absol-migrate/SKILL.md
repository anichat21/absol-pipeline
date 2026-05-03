---
name: absol-migrate
description: One-shot migration of an existing absol project from the flat layout to the .absol/ layout. Reads the project, presents a kept-vs-dropped plan, only writes on user confirmation. Git is the revert path. Use when the user says '/absol-migrate', 'migrate this project', or asks to upgrade an old absol project to the new structure.
---

# absol-migrate

Convert an existing absol project from flat layout (everything at root) to `.absol/` layout. Rewrite, not surgical preservation — most pipeline state is past (promoted inbox items, old session logs, completed plan entries). Extract what's durable, scaffold clean, discard the rest. Git is the long-term archive.

Opt-in, one-shot. `/absol-migrate` auto-detects from cwd (walk up to 5 levels for `state.md`); `/absol-migrate <path>` for explicit path.

## 1. Pre-flight

Refuse unless every condition holds. When `--force` is needed, surface the failure inline and use the **`AskUserQuestion` tool** to confirm — never as `[y/n]` plain text.

| Check | Pass | On fail |
|---|---|---|
| Already migrated | `.absol/` does not exist | Bail |
| Project shape | `state.md` exists | Bail: not an absol project |
| Pipeline idle | `todo-run.md` empty | Bail: finalize first |
| Tasks idle | `todo.md` empty or all `status: done` | `AskUserQuestion`: **Proceed anyway** / **Cancel** |
| Git clean | `git status --porcelain` empty | Surface diff; `AskUserQuestion`: **Migrate anyway** (mixes the migration diff with in-flight work) / **Cancel** |
| Git project | `.git/` exists | If absent, `AskUserQuestion`: **Migrate anyway** (revert is manual without git) / **Cancel** |

## 2. Read & extract

| Source | Action |
|---|---|
| `vision.md`, `roadmap.md` | Verbatim |
| `CLAUDE.md` | Identify user-customised sections (Stack, run commands, Architecture, user edits). Discard auto-generated MD-files table. |
| `state.md` Tech Debt | Body → `.absol/tech-debt.md` |
| `state.md` Known Bugs | Body → `.absol/bugs.md` |
| `state.md` In Progress | Body → new state.md |
| `state.md` Last Session | Compress to one-line summary |
| `state.md` Planned Features | Step 3 |
| `inbox.md` | Keep `status: new` and `status: needs-shaping` only |
| `plan.md` | Keep entries that aren't `status: done` |
| `todo.md`, `todo-run.md` | Discard (pre-flight ensured empty) |

Tolerate missing/non-standard headers — flag them as "not found" in the report.

## 3. Surface Planned Features (interactive)

If `state.md` has a Planned Features section with items, list them inline, then use the **`AskUserQuestion` tool**:

- question: `state.md "Planned Features" has {N} items. Promote them to .absol/inbox.md as status: new?`
- header: `Promote features`
- options:
  - **Promote all** — every item becomes an `[item]` in `.absol/inbox.md` with `status: new`.
  - **Pick per item** — loop with `AskUserQuestion` once per item: **Promote** / **Drop**.
  - **Drop all** — none are promoted.

Skip this step silently if the section is empty or missing.

## 4. Show kept/dropped report

Single summary before any write. Show the report inline, then use the **`AskUserQuestion` tool** to confirm.

Summary text:

```
Migration plan for {project}:

KEEP:
  vision.md, roadmap.md (verbatim)
  CLAUDE.md custom sections ({n} lines)
  state.md In Progress, Tech Debt, Known Bugs, last session (compressed)
  inbox.md active items ({n})
  plan.md active entries ({n})
  Planned Features ({n}) → inbox.md as status: new

DROP (recoverable from git):
  inbox.md historical (all status: promoted)
  state.md older sessions
  plan.md done entries
  CLAUDE.md auto-generated MD-files table

SCAFFOLD:
  .absol/CONTEXT.md, adr/0000-template.md, todo.md, todo-run.md, archive/

WARNINGS: {any "not found" sections}
```

Then `AskUserQuestion`:

- question: `Apply this migration plan?`
- header: `Migrate`
- options:
  - **Apply** — proceed to Step 5.
  - **Cancel** — abort cleanly. Nothing has been written.

## 5. Apply

On `y`:

1. Delete root `inbox.md`, `plan.md`, `todo.md`, `todo-run.md`. (`vision.md`, `roadmap.md`, `state.md`, `CLAUDE.md` stay at root — rewritten in place.)
2. Scaffold `.absol/` (use `absol-newproject` templates for empty files; populate `bugs.md`, `tech-debt.md`, `inbox.md`, `plan.md` from extracted content).
3. Rewrite `state.md` from the new template (Last Session one-liner, In Progress, Parked Items). No Tech Debt / Known Bugs / Planned Features sections — those moved to `.absol/`.
4. Rewrite `CLAUDE.md` from the new template (including the **Capture as we discuss** section that prompts in-conversation note-taking, the regenerated **Project MD Files** table pointing at `.absol/` paths, and the new **Wrap-Up** rule). Splice in user-customised sections (Stack, run commands, Architecture, anything else they added) into the right places.
5. Append the absol gitignore lines (idempotent — skip lines that already exist):
   ```
   .absol/inbox.md
   .absol/plan.md
   .absol/todo.md
   .absol/todo-run.md
   .absol/archive/
   ```

## 6. Final report

```
Migration complete: {project}

Wrote:    .absol/ ({n} files), state.md, CLAUDE.md, .gitignore (5 lines)
Deleted:  inbox.md, plan.md, todo.md, todo-run.md (root)

Revert:   git restore . && git clean -fd .absol/
Diff:     git diff && git status .absol/
```

Non-git project (`--force` was given): warn that revert is manual.

## Ownership

- Read-only until user approves Step 4. Steps 1–4 don't write.
- Doesn't touch code, non-absol MD files (e.g. per-feature design docs alongside state.md), or git (no auto-commit). The diff is left for the user.
- One project at a time. No batch mode.
