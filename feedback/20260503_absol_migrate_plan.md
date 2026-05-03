# `absol-migrate` Skill — Plan

Companion to `20260503_absol_overhaul_plan.md`. The migration skill that ships alongside the overhaul so existing flat-layout projects (snowowl, huntrx, etc.) can move to the new `.absol/` layout.

**Approach: rewrite, not surgical migration.** Most of an existing project's pipeline state is genuinely past — promoted inbox items, old session logs, completed plan entries. Preserving all of that into a `.absol/archive/` folder is hoarding, not preservation. The skill instead reads the project, extracts what's durable, scaffolds a clean new layout, and discards the rest. Git is the long-term archive.

This is a planning doc. The actual `SKILL.md` follows after sign-off.

---

## 1. Purpose

Convert an existing absol project from the flat layout (all MD files in project root, debt/bugs embedded in `state.md`) to the new layout (`CLAUDE.md`, `state.md`, `vision.md`, `roadmap.md` at root; everything else in `.absol/`).

The skill is **opt-in and one-shot**. The user runs it once per project when ready to migrate. It reads, presents a "kept vs dropped" plan, and only proceeds on user confirmation.

---

## 2. Invocation & detection

- **Skill name:** `absol-migrate`
- **Lives at:** `projects/absol/skills/absol-migrate/SKILL.md`, duplicated to `~/.claude/skills/absol-migrate/`.
- **Invocation:**
  - `/absol-migrate` — auto-detects the project from cwd (walks upward looking for `state.md` or `CLAUDE.md`).
  - `/absol-migrate <path>` — operates on the project at the given path.

If auto-detection fails (no project shape found within 5 levels up), bail and ask for an explicit path.

---

## 3. Pre-flight checks

Refuse to proceed if any of these fail:

| Check | Pass condition | On fail |
|---|---|---|
| Already migrated | `.absol/` does not exist | Bail with "project already migrated" |
| Pipeline idle | `todo-run.md` empty or absent | Bail with "active run detected — finalize first" |
| Tasks idle | `todo.md` empty, or all `status: done` | Warn; allow proceed with confirmation |
| Project shape | `state.md` exists | Bail with "doesn't look like an absol project" |
| Git clean | `git status --porcelain` is empty | Surface diff; require explicit `--force` to proceed |
| Non-git project | `.git` not found | Allow only with `--force`; warn that revert is manual |

`--force` is asked for interactively when needed, not a CLI flag.

---

## 4. Migration steps

### Step 1 — Read & extract

Single read pass. Build an in-memory representation of what's durable:

| Source | Action |
|---|---|
| `vision.md` | Keep verbatim |
| `roadmap.md` | Keep verbatim |
| `CLAUDE.md` | Read; identify custom sections (Stack table, run commands, user edits). Discard the auto-generated "Project MD Files" table (regenerated from template) |
| `state.md` Tech Debt section | Extract body |
| `state.md` Known Bugs section | Extract body |
| `state.md` In Progress section | Extract body if non-empty |
| `state.md` Last Session | Extract only the most recent entry, compressed to a one-line summary |
| `state.md` Planned Features | Extract — handled interactively in Step 2 |
| `inbox.md` | Keep only entries with `status: new` or `status: needs-shaping` |
| `plan.md` | Keep entries that look active (no `status: done`) |
| `todo.md` / `todo-run.md` | Discarded (pre-flight ensured they're already empty) |

### Step 2 — Surface "Planned Features" to user

If `state.md` has a Planned Features section with items, present them:

```
state.md "Planned Features" section has {N} items:

  1. {item}
  2. {item}
  ...

Promote these to .absol/inbox.md as status: new? [y / n / select]
```

- `y` — all items become `[item]` entries in `inbox.md` with `status: new`.
- `n` — drop them entirely.
- `select` — ask per-item.

If the section is missing or empty, skip this step silently.

### Step 3 — Show kept / dropped report

Before writing anything, present a single summary of what the migration will do:

```
Migration plan for {project}:

KEEP (will be written into new layout):
  vision.md            ({n} lines, verbatim)
  roadmap.md           ({n} lines, verbatim)
  CLAUDE.md custom    ({n} lines — stack, ports, run commands, user edits)
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
  .absol/CONTEXT.md     — empty glossary
  .absol/adr/0000-template.md  — ADR template
  .absol/todo.md        — empty
  .absol/todo-run.md    — empty

Apply? [y / n]
```

- `y` — proceed to Step 4.
- `n` — abort. Nothing has been written; no rollback needed.

### Step 4 — Delete superseded root files

Once the user approves: delete `inbox.md`, `plan.md`, `todo.md`, `todo-run.md` from the project root. (They're being replaced by the `.absol/` versions; leaving the originals would create confusion.)

`vision.md`, `roadmap.md`, `state.md`, `CLAUDE.md` stay at root — they're being rewritten in place, not relocated.

### Step 5 — Write the new layout

Lay down `.absol/` populated from the extracted content:

```
.absol/
├── CONTEXT.md          ← empty glossary template
├── adr/0000-template.md
├── inbox.md            ← active items + promoted planned features
├── plan.md             ← active entries
├── todo.md             ← empty header
├── todo-run.md         ← empty header
├── bugs.md             ← from state.md Known Bugs
├── tech-debt.md        ← from state.md Tech Debt
└── archive/            ← empty folder (used by future finalize runs)
```

### Step 6 — Rewrite root files

- **`state.md`** — regenerate from template. Sections: Last Updated, Last Session (one-line summary from Step 1), In Progress (extracted content or "Nothing"), Planned Features (placeholder; the section is kept as a structural element but its content moved to inbox in Step 2).
- **`CLAUDE.md`** — regenerate the standard sections from template (Project MD Files table pointing at new paths, Wrap-Up Rule). Splice in the user's custom sections (Stack, run commands, etc.) from Step 1. Diff is shown post-write as part of the final report.
- **`.gitignore`** — append the five new lines (idempotent — skip if already present):
  ```
  .absol/inbox.md
  .absol/plan.md
  .absol/todo.md
  .absol/todo-run.md
  .absol/archive/
  ```

### Step 7 — Final report

Print a short summary so the user sees what just happened:

```
Migration complete: {project}

Wrote:
  .absol/ ({n} files)
  state.md (rewritten — old version in git history)
  CLAUDE.md (rewritten with file-index regenerated)
  .gitignore (5 lines appended)

Deleted from root:
  inbox.md, plan.md, todo.md, todo-run.md

Revert: git restore . && git clean -fd .absol/

Diff for review:
  git diff
```

---

## 5. Reversibility

Git only. The pre-flight ensures the repo is clean before starting (or `--force` was given). The migration produces a single coherent diff:

- Modified at root: `state.md`, `CLAUDE.md`, `.gitignore`
- Deleted at root: `inbox.md`, `plan.md`, `todo.md`, `todo-run.md`
- New (untracked): `.absol/` with all its contents

**Revert path:**
- `git restore .` — restores modified and deleted root files.
- `git clean -fd .absol/` — removes the new untracked folder.

Two commands, project back to flat layout, no residue.

**Non-git projects (`--force`):** revert is manual. Warn loudly in pre-flight.

No backup folder. No internal undo log. Git is the right tool for this.

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| User rejects the plan in Step 3 | Nothing written yet; clean abort, no rollback |
| Extraction misreads `state.md` (non-standard headers) | Extraction tolerates missing sections; report flags them as "not found" so user notices before approving |
| CLAUDE.md custom sections lost in regeneration | Step 6 splices in user customisations identified in Step 1; the kept/dropped report names them so the user verifies they were caught |
| User has uncommitted unrelated work | Pre-flight refuses without `--force`; surfaces diff so user can stash/commit first |
| Project isn't actually absol-shaped | Pre-flight requires `state.md`; bails otherwise |
| `--force` user reverts but forgets `git clean -fd` | Final report includes both commands explicitly |
| Skill duplication: source + `~/.claude/skills/` copy diverge | Document in absol README; sync helper later |

---

## 7. Out of scope

The migration skill does **not**:

- Preserve historical inbox items, old session logs, or completed plan entries. These live in git history.
- Bootstrap `CONTEXT.md` from existing code. It ships empty; lazy growth is the model.
- Promote tech-debt items into actionable inbox tasks. That's the architect skill's job.
- Run finalizer-style compaction beyond the one-line Last Session summary in Step 1.
- Touch any code files (TypeScript, Python, etc.) or non-absol MD files (e.g. snowowl's `assetguide.md`).
- Stage or commit anything in git. The diff is left in the working tree for the user to commit deliberately.
- Update deployed copies of any other skill in `~/.claude/skills/`. Sync is a separate concern.

---

## 8. Rollout

The migration skill ships in **Phase 0** of the overhaul, alongside:
- Updated `absol-newproject` template (new projects get the new layout from day 1).
- Expanded finalizer (archive policy for ongoing runs).
- The token optimizations from the carry-forward list.

Phase 0 is the structural phase: new layout becomes available for both new projects (via newproject) and existing projects (via migrate). Phases 1–3 of the overhaul build on top of the new layout.

No behavioural changes to the pipeline ship without the migration path being available — users opt into both at the same time, per project.
