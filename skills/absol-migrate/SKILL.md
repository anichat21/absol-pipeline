---
name: absol-migrate
description: One-shot migration of an absol project to the current redesigned layout/schema. Handles two paths automatically — flat layout (everything at root) → .absol/ folder, and old .absol/ layout (pre-redesign schema — bullet-list bugs/tech-debt, [plan-item], todo.md, todo-run.md, status: shaped/promoted/resolved, etc.) → new schema (unified [note], run-active.md per-run, new plan.md shape). Reads the project, presents a kept-vs-dropped plan, only writes on user confirmation. Git is the revert path. Use when the user says '/absol-migrate', 'migrate this project', 'upgrade absol', or asks to bring an old absol project up to date.
---

# absol-migrate

Convert an absol project to the **current** layout and schema. Two upgrade paths, auto-detected:

| Path | Detected when | Work |
|---|---|---|
| **flat → .absol/** | No `.absol/` folder; `state.md` at root | Move durable content into new `.absol/` files, scaffold the rest, rewrite root MD files |
| **old .absol/ → new schema** | `.absol/` exists AND any of: `.absol/todo.md` exists; `.absol/todo-run.md` exists; `.absol/plan.md` lacks "Plan Queue" header; `.absol/plan.md` contains `[plan-item]`; `.absol/bugs.md` or `.absol/tech-debt.md` is in bullet-list format (no `[note]` blocks); any `.absol/inbox.md` / `bugs.md` / `tech-debt.md` `[note]` carries deprecated fields (`route`, `batchable`, `needs_arch_review`, `shaped_into`, `parking_note`, `promoted_to`); CLAUDE.md "Project MD Files" table mentions `todo.md` or `todo-run.md` | Drop pre-redesign churn (`todo.md`, `todo-run.md`), wipe `plan.md` shape, upgrade `bugs.md` / `tech-debt.md` to unified `[note]` schema (synthesise from bullets if needed), preserve shaped intent, swap gitignore lines (remove todo*, add `run-active.md`) |

Pipeline state is ephemeral by design. The migration preserves the **durable** stuff (vision, roadmap, ADRs, CONTEXT.md, bugs, tech-debt, state.md truth-snapshot, shaped intent in inbox/plan-items if you opt in via Step 3a) and discards the in-flight churn that the new pipeline regenerates anyway (todo*, finalizer-managed sections of state.md, raw plan.md shape).

Opt-in, one-shot. `/absol-migrate` auto-detects from cwd (walk up to 5 levels for `state.md`); `/absol-migrate <path>` for explicit path.

## 1. Pre-flight

Refuse unless every condition holds. When `--force` is needed, surface the failure and use the **`AskUserQuestion` tool** to confirm — never as `[y/n]` plain text.

| Check | Pass | On fail |
|---|---|---|
| Project shape | `state.md` exists | Bail: not an absol project |
| Layout state | flat OR old `.absol/` (auto-detected) | Bail: already on new layout, nothing to do |
| Pause idle | No `## Pause` section in `state.md` | Bail: resume or finalize-away the pause first via `/absol` |
| Active run idle | No `## Active Run` section in `state.md`; no `run-active.md`; legacy `todo-run.md` (if present) is empty or absent | Bail: finalize the active run first |
| Git clean | `git status --porcelain` empty | Surface diff; `AskUserQuestion`: **Migrate anyway** (mixes the migration diff with in-flight work) / **Cancel** |
| Git project | `.git/` exists | If absent, `AskUserQuestion`: **Migrate anyway** (revert is manual without git) / **Cancel** |

## 2. Read & extract (path-dependent)

### 2a. Flat-layout path

| Source | Action |
|---|---|
| `vision.md`, `roadmap.md` | Verbatim |
| `CLAUDE.md` | Identify user-customised sections (Stack, run commands, Architecture, user edits). Discard auto-generated MD-files table (regenerated). |
| `state.md` Tech Debt | Body bullets → `.absol/tech-debt.md`. If bullets, run *2c. Bullet-list synthesis*. If already `[note]`s, schema-upgrade per 2b's `tech-debt.md` row. |
| `state.md` Known Bugs | Body bullets → `.absol/bugs.md`. Same rules as Tech Debt — synthesise via 2c if bullets, schema-upgrade otherwise; resolved-bugs disposition via Step 3a. |
| `state.md` In Progress | Body → new state.md In Progress section |
| `state.md` Last Session | Compress to one sentence (drop "Previous Session" / multi-session blocks the same way 2b does for `state.md`) |
| `state.md` Planned Features | Step 3b (interactive) |
| `inbox.md` | Same rules as 2b's `inbox.md` row — keep `status: new`/`shaped`/`shaping`/`needs-shaping` (all become `status: new`), preserve `shaper_notes:`, drop deprecated fields, route `status: promoted` through Step 3a. |
| `plan.md` | Same as 2b's `plan.md` row — discard the file shape, surface plan-items with rich body via Step 3a for opt-in conversion to inbox notes. |
| `todo.md`, `todo-run.md` | Discard (pre-flight ensured idle). `run-active.md` will be created on first run by orchestrator/scratchpad. |

### 2b. Old-`.absol/` path

| Source | Action |
|---|---|
| `.absol/CONTEXT.md` | Verbatim. Rewrite stale references (e.g., `/grill-me` → `/absol-shaper`) — string-level, leave the rest alone. |
| `.absol/adr/` | Verbatim |
| `.absol/bugs.md` | If file uses bullet-list format (no `[note]` blocks, just `- **Term**: …` or plain `- …`), synthesise `[note]` entries — see *2c. Bullet-list synthesis*. Otherwise convert each `[note]` to unified schema: keep `id`/`title`/`description`/`type`/`priority`/`subsystem`. Drop `promoted_to`. Items with `status: resolved` get a disposition prompt — see *3a. Disposition prompts*. Otherwise `status: new`. |
| `.absol/tech-debt.md` | Same rules as bugs.md, but no resolved-disposition prompt (resolved debt isn't a recognised state — bullets / `[note]`s become `status: new`). Type defaults to `CHORE` when synthesising from bullets. |
| `.absol/inbox.md` | Keep items with `status: new`, `status: shaped`, `status: shaping`, or `status: needs-shaping`. All become `status: new`. Drop `route`, `batchable`, `needs_arch_review`, `shaped_into`, `parking_note`. **Preserve `shaper_notes:`** if present — it carries shaping work the user already invested. Items with `status: promoted` (orphaned by plan.md discard) get a disposition prompt — see *3a. Disposition prompts*. |
| `.absol/plan.md` | Discard the file shape, but surface every `[plan-item]` for disposition — see *3a. Disposition prompts*. Plan items with rich content (deferred rationale, shaped seeds with modules/testing/out_of_scope) can be converted to inbox notes lossless. Planner/architect regenerates the new `plan.md` next pipeline run. |
| `.absol/todo.md` | Discard (file is gone in new design). |
| `.absol/todo-run.md` | Discard (renamed to `run-active.md`; pre-flight ensured this was idle, and the new shape has different structure). New file created on first run. |
| `.absol/archive/` | Verbatim. |
| `state.md` | Keep only the three current sections: Last Session, In Progress, Parked Items. Strip everything else, including Tech Debt / Known Bugs / Planned Features (legacy pre-`.absol/`), and any "Previous Session" / "Older Sessions" / "Pipeline History" / multi-session blocks (compress to a one-line Last Session — older entries are already in `archive/sessions-*.md`). Don't synthesise content; if Last Session is multi-paragraph, keep its first sentence and drop the rest. |
| `CLAUDE.md` | Update Project MD Files table to current shape (no `todo.md` row, `run-active.md` listed, descriptions match `absol-newproject`'s template). Rewrite the Wrap-Up paragraph if it mentions `todo-run.md` / `todo.md` / old finalizer scope — replace with the current Wrap-Up text. Splice user-customised sections (Stack, run commands, Architecture, design rulebooks) verbatim. |

Tolerate missing/non-standard headers — flag them as "not found" in the report.

### 2c. Bullet-list synthesis (`bugs.md` / `tech-debt.md`)

When `bugs.md` or `tech-debt.md` is in legacy bullet-list format — i.e., zero `[note]` blocks, just dashed bullets — synthesise unified `[note]` entries one-per-bullet, mechanically:

- **id**: zero-padded sequential, starting at `001` per file (`BUG-001`, `BUG-002`, …; or `DEBT-001`, …). Independent counter per file.
- **title**: if the bullet leads with `**bolded text**:` or `**bolded text**` — use the bolded text. Otherwise use the first sentence (cut at first `.` / `:` / `—`), capped at ~80 chars.
- **description**: full bullet body verbatim (minus the title prefix if extracted). Multi-line bullets keep their continuation text.
- **type**: `BUG` for `bugs.md`; `CHORE` for `tech-debt.md`.
- **priority**: `medium` (default — user can re-prioritise later).
- **subsystem**: `unknown` if not obvious from the bullet text. Don't guess.
- **status**: `new`.

Don't try to be clever — bullet text into the description field, lossless. The user reviews the result post-migration.

## 3a. Disposition prompts (interactive, both paths)

Three classes of content don't have a clean automatic conversion. Surface each cohort once, list the items inline so the user can scan, and use **`AskUserQuestion`** to pick a disposition. Apply per-cohort, not per-item — a single decision keeps the prompt count bounded.

### Resolved bugs

If `bugs.md` has any `[note]` with `status: resolved` (typically with a `resolution:` field):

- question: `bugs.md has {N} resolved bug(s). How to handle them?`
- header: `Resolved bugs`
- options:
  - **Drop** — remove from `bugs.md`. The fix lives in code + git history; `archive/run-*.md` (if present) carries the audit trail. *Default.*
  - **Keep as resolved** — preserve verbatim under unified `[note]` schema, retain `status: resolved` as an extension status. (Not in the canonical schema, but harmless — finalizer ignores.)
  - **Pick per item** — loop with `AskUserQuestion` once per resolved bug: **Drop** / **Keep as resolved** / **Draft as ADR** (template in `.absol/adr/`, status `accepted`, captures the decision).

### Orphaned promoted notes

If `inbox.md` / `bugs.md` / `tech-debt.md` has any `[note]` with `status: promoted` (these point to plans being discarded):

- question: `{N} note(s) are status: promoted, but plan.md is being discarded. How to handle?`
- header: `Orphaned notes`
- options:
  - **Reset to new** — these become `status: new` seeds again; the next planner pass can re-promote. *Default.*
  - **Drop** — assume the plan absorbed their content and the note is no longer needed.
  - **Pick per item** — loop with `AskUserQuestion` per note.

### Plan items with content worth preserving

If `plan.md` has any `[plan-item]` with rich body (any of: `modules`, `testing`, `out_of_scope`, `pre_approved_decisions`, or `status: deferred` with rationale), surface them inline:

```
Plan items with content:
  - PLN-013 (status: deferred): {first line of problem/title}
  - PLN-014 (status: shaped, source: INBOX-002): {title}
```

Then `AskUserQuestion`:

- question: `{N} plan item(s) carry content not captured elsewhere. How to handle before discarding plan.md?`
- header: `Plan content`
- options:
  - **Convert each to inbox note** — synthesise an INBOX-NNN entry per plan-item: `title` from the plan-item title, `description` from `problem` (or first paragraph), `type`/`priority` carried, `subsystem` carried, `status: new`. Fold the structured content (`proposed_direction`, `modules`, `testing`, `out_of_scope`, `pre_approved_decisions`, deferral rationale) into a `shaper_notes:` block on the new note so the planner can pick them up directly. If the plan-item has `source: INBOX-NNN` and that source still exists in inbox.md, attach the shaper_notes to the source note instead of creating a duplicate. *Default.*
  - **Pick per item** — loop with `AskUserQuestion` per plan-item: **Convert** / **Drop**.
  - **Drop all** — accept the loss; planner re-derives from inbox/bugs/tech-debt next run.

Skip a cohort silently when its source set is empty.

## 3b. Surface Planned Features (interactive, flat-layout path only)

If `state.md` has a Planned Features section with items, list them inline, then use the **`AskUserQuestion` tool**:

- question: `state.md "Planned Features" has {N} items. Promote them to .absol/inbox.md as status: new?`
- header: `Promote features`
- options:
  - **Promote all** — every item becomes a `[note]` in `.absol/inbox.md`.
  - **Pick per item** — loop with `AskUserQuestion` once per item: **Promote** / **Drop**.
  - **Drop all** — none are promoted.

Skip silently if the section is empty or missing or you're on the old-`.absol/` path.

## 4. Show kept/dropped report

Single summary before any write. Show the report inline, then use the **`AskUserQuestion` tool** to confirm.

```
Migration plan for {project} ({path}):

Detected: {flat layout | old .absol/ layout}

KEEP:
  vision.md, roadmap.md (verbatim)                    [flat path]
  CLAUDE.md custom sections ({n} lines)
  state.md Last Session (compressed) + In Progress + Parked Items
  bugs.md / tech-debt.md ({n}+{m}) — schema upgraded
    {if synthesised from bullets:} bullet→[note] synthesised: bugs ({k}), tech-debt ({j})
  inbox.md active notes ({n}) — schema upgraded
    {if any:} shaper_notes preserved on ({k}) note(s)
  CONTEXT.md, adr/                                    [old-.absol path]
  archive/                                            [old-.absol path]
  Planned Features ({n}) → inbox.md                   [flat path, if user chose Promote]
  Plan items converted to inbox notes ({n})           [old-.absol, if user chose Convert]
  Resolved bugs kept ({n}) / dropped ({k})            [old-.absol]
  Promoted notes reset to new ({n}) / dropped ({k})   [old-.absol]

DROP (recoverable from git):
  inbox.md historical (status: promoted/etc — per Step 3a disposition)
  plan.md file shape (rich content folded into inbox per Step 3a)
  todo.md (file removed in redesign)                  [old-.absol path]
  todo-run.md (renamed to run-active.md, new shape)   [old-.absol path]
  state.md "Previous Session" / "Older Sessions" / accumulator sections
  CLAUDE.md auto-generated MD-files table
  CONTEXT.md stale references (e.g., /grill-me → /absol-shaper)  [old-.absol]

SCAFFOLD:
  .absol/CONTEXT.md, adr/0000-template.md             [flat path only]
  .absol/plan.md, archive/                            [flat path only]
  .gitignore absol pipeline lines (idempotent — new gitignore uses .absol/run-active.md)

WARNINGS: {any "not found" sections}
```

Then `AskUserQuestion`:

- question: `Apply this migration plan?`
- header: `Migrate`
- options:
  - **Apply** — proceed to Step 5.
  - **Cancel** — abort cleanly. Nothing has been written yet.

## 5. Apply

On Apply:

### 5a. Flat-layout path

1. `mkdir -p .absol/adr .absol/archive`.
2. Delete root `inbox.md`, `plan.md`, `todo.md`, `todo-run.md` (root). (`vision.md`, `roadmap.md`, `state.md`, `CLAUDE.md` stay at root — rewritten in place.)
3. Scaffold `.absol/` (use `absol-newproject` templates for empty files; populate `bugs.md`, `tech-debt.md`, `inbox.md` from extracted content using the unified `[note]` schema).
4. Write `.absol/CONTEXT.md` and `.absol/adr/0000-template.md` from `absol-newproject` templates.
5. Rewrite `state.md` from the new template (Last Session one-liner, In Progress, Parked Items). No Tech Debt / Known Bugs / Planned Features sections.
6. Rewrite `CLAUDE.md` from the new template (Project MD Files table, Capture-as-we-discuss section, Wrap-Up rule). Splice in user-customised sections.
7. Append absol gitignore lines (idempotent):
   ```
   .absol/inbox.md
   .absol/plan.md
   .absol/run-active.md
   .absol/archive/
   ```

### 5b. Old-`.absol/` path

1. `rm .absol/todo.md` if present.
2. `rm .absol/todo-run.md` if present (file renamed to `run-active.md`; new file is created on first run, not at migrate time).
3. Rewrite `.absol/inbox.md` with unified `[note]` schema entries (kept items only — `status: new`/`shaped`/`shaping`/`needs-shaping` plus orphaned-promoted dispositions from Step 3a). Preserve `shaper_notes:` blocks. If any plan-items were converted to inbox notes (Step 3a), append them now (or merge `shaper_notes` into an existing source note if the plan-item had `source: INBOX-NNN`). If file ends up empty, write the placeholder: `No items yet.`
4. Rewrite `.absol/bugs.md` and `.absol/tech-debt.md` with unified `[note]` schema entries (synthesised from bullets via 2c if applicable; resolved-bugs disposition from Step 3a applied). If empty, write the placeholder text from `absol-newproject`'s template.
5. Rewrite `.absol/plan.md` with the new placeholder: `No active plans. Run /absol and choose pipeline mode to plan from inbox/bugs/tech-debt, or /absol-architect for a refactor plan.`
6. Rewrite `.absol/CONTEXT.md` only if it had stale references rewritten in Step 2b (otherwise leave verbatim — preserve the project's domain glossary). Don't touch `## Domain Terms` content; only touch the lazy-grow attribution line and similar boilerplate.
7. Rewrite `state.md` keeping only Last Session (one-sentence compression of whatever was there — if multi-paragraph, keep first sentence), In Progress, Parked Items. Strip Tech Debt / Known Bugs / Planned Features (legacy pre-`.absol/`) and any "Previous Session" / "Older Sessions" / "Pipeline History" / multi-session blocks. Don't add `## Active Run` or `## Pause` — those are transient.
8. Update `CLAUDE.md` Project MD Files table (remove `todo.md` row; ensure `run-active.md` is listed; descriptions match `absol-newproject`'s template). Rewrite the Wrap-Up paragraph if it referenced `todo-run.md` / `todo.md` / old finalizer scope. Splice user-customised sections (Stack, run commands, Architecture, design rulebooks) verbatim.
9. Update `.gitignore`: remove `.absol/todo.md` and `.absol/todo-run.md` lines if present; add `.absol/run-active.md` if missing. (Idempotent.)
10. Ensure `.absol/archive/.gitkeep` exists (mkdir-marker; harmless if `archive/` is gitignored).

## 6. Final report

```
Migration complete: {project}

Path:     {flat layout → .absol/ | old .absol/ → new schema}
Wrote:    {list of files written/rewritten}
Deleted:  {list of files removed}
Notes:    inbox.md ({n}), bugs.md ({n}), tech-debt.md ({n}) carried forward

Revert:   git restore . && git clean -fd .absol/    (flat → .absol/ — restores moved files, removes scaffolded ones)
          git restore .                              (old .absol/ → new schema — only file shapes changed)
Diff:     git diff && git status .absol/

Next: /absol on this project to start a session.
```

Non-git project (`--force` was given): warn that revert is manual.

## Ownership

- Read-only until user approves Step 5. Steps 1–4 don't write.
- Doesn't touch code, non-absol MD files (e.g. per-feature design docs alongside state.md), or git (no auto-commit). The diff is left for the user.
- One project at a time. No batch mode.
- Pipeline state (inbox.md/plan.md/todo-run.md churn) is intentionally regenerated, not preserved. The current pipeline does not need historical inbox items to function.
