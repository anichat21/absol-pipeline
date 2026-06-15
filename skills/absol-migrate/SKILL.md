---
name: absol-migrate
description: Migrates an absol project to the current layout/schema after an absol release that changed file shapes. A reusable shell — each schema-changing release fills in the "Migration delta" section with what moved/renamed/reshaped; the workflow around it (pre-flight, read, kept-vs-dropped report, confirm, apply, git-revert) stays fixed. No-ops cleanly when the project is already on the current schema. Reads first, only writes on user confirmation; git is the revert path. Use when the user says '/absol-migrate', 'migrate this project', or 'upgrade absol' after a release.
---

# absol-migrate

Bring an absol project up to the **current** layout and schema after an absol release that changed file shapes.

This skill is a **shell**. The *workflow* (pre-flight → read → report → confirm → apply → revert) is fixed and reusable. The *content* — what actually changed this release — lives in one place, the **Migration delta** section below. When a release reshapes files, fill that section in; the rest stays untouched.

Opt-in, one-shot, one project at a time. `/absol-migrate` auto-detects from cwd (walk up to 5 levels for `state.md`); `/absol-migrate <path>` for an explicit path.

## Migration delta (fill in per release)

> **Status: no migration currently defined.** All known projects are on the current `.absol/` schema. If you reach Step 2 and find nothing here applies, report "already current — nothing to migrate" and stop.

When a release changes file shapes, define the delta here so the workflow below has something to apply:

- **detect:** the cheap signal that a project predates this release (e.g. "`.absol/<old-file>` exists", "`<file>` lacks the `<new-header>` header", "`[note]` carries field `<deprecated>`").
- **transform:** per affected file, old shape → new shape. Be explicit and lossless; synthesise only when mechanical.
- **drop:** files/sections the new design regenerates (recoverable from git).
- **scaffold:** new files the release introduced (pull empty templates from `absol-newproject`).
- **gitignore:** lines to add/remove.

Keep transforms mechanical and reviewable — the user reviews the diff post-migration, so don't be clever. Tolerate missing/non-standard headers; flag them as "not found" in the report rather than guessing.

## 1. Pre-flight

Refuse unless every condition holds. Surface any failure and confirm via the **`AskUserQuestion` tool** — never plain `[y/n]` text.

| Check | Pass | On fail |
|---|---|---|
| Project shape | `state.md` exists | Bail: not an absol project |
| Needs migration | the Migration-delta `detect` signal matches | Bail: already on current schema, nothing to do |
| Pause idle | no `## Pause` in `state.md` | Bail: resume or finalize-away the pause first via `/absol` |
| Active run idle | no `## Active Run` in `state.md`; no live `run-active.md` | Bail: finalize the active run first |
| Git clean | `git status --porcelain` empty | Surface diff; `AskUserQuestion`: **Migrate anyway** (mixes migration diff with in-flight work) / **Cancel** |
| Git project | `.git/` exists | If absent, `AskUserQuestion`: **Migrate anyway** (revert is manual without git) / **Cancel** |

## 2. Read & extract

Read the affected files (per the Migration delta). Preserve durable content (CLAUDE.md, ADRs, CONTEXT.md, bugs, tech-debt, the state.md truth-snapshot, and `roadmap.md` if the project keeps one); plan/run churn is regenerated, not migrated. Don't write anything yet.

If a class of content has no clean automatic transform (e.g. items in a status the new schema dropped), surface that cohort once, list the items inline, and use **`AskUserQuestion`** for a per-cohort disposition (keep / drop / convert) — bounded prompts, not one per item.

## 3. Kept/dropped report

One summary before any write. Show it inline, then confirm via **`AskUserQuestion`**.

```
Migration plan for {project} ({path}):

Release:  {what changed this release}

KEEP:     {durable content carried forward, schema-upgraded}
DROP:     {regenerated churn — recoverable from git}
SCAFFOLD: {new files this release introduced}
WARNINGS: {any "not found" sections}
```

- question: `Apply this migration plan?`  · header: `Migrate`
- options: **Apply** (proceed to Step 4) / **Cancel** (abort cleanly — nothing written yet).

## 4. Apply

Execute the Migration-delta transforms: rewrite changed files in place, delete dropped files, scaffold new ones from `absol-newproject` templates, update `.gitignore` (idempotent). Don't add transient sections (`## Active Run`, `## Pause`) or touch code, non-absol MD files, or git.

## 5. Final report

```
Migration complete: {project}

Wrote:   {files written/rewritten}
Deleted: {files removed}
Revert:  git restore . && git clean -fd .absol/   (removes scaffolded files too)
Diff:    git diff && git status .absol/

Next: /absol on this project to start a session.
```

Non-git project (migrate-anyway was chosen): warn that revert is manual.

## Ownership

- Read-only until the user approves Step 4 (Steps 1–3 never write).
- Touches no code, non-absol MD files, or git — the diff is left for the user to review and commit.
