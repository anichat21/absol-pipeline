---
name: absol-migrate
description: Migrates an absol project to the current schema after a release changed file shapes. Reads first, reports kept-vs-dropped, applies only on confirmation; git is the revert path. No-ops when already current. Use on '/absol-migrate', 'migrate this project', or 'upgrade absol'.
---

# absol-migrate

Reusable shell; the **Migration delta** below is rewritten by each schema-changing release.
Pre-flight: the project must be a clean git tree (or the user accepts migrating dirty —
confirm). Read everything the delta touches, print a kept-vs-dropped report, get one
confirmation, apply, commit ("absol-migrate: <delta name>"). Already current → say so, stop.

## Migration delta — v2 item-centric ledger (2026-07)

Target shapes: `~/.claude/skills/absol/references/schemas.md`.

1. **Live run first.** `run-active.md` present → stop; tell the user to open `/absol` so the
   old run is recovered/finalized before migrating.
2. **state.md** — delete `## Active Run`, `## Pause`, `## Owes Human Smoke` (each owed entry
   becomes a VERIFY item, step 4), and accumulated history sections. Keep/rename to
   `## Last Session` + `## Open Threads`.
3. **Notes → items** in inbox/bugs/tech-debt: `[note]` → `[item]`; drop `status:` and
   `promoted_to:` (planned-ness is derived now); rename `shaper_notes:` → `shape:` and
   `research_notes:` → `map:`; `prior_work:` → `prior:`.
4. **Owed smoke** → one `[item] type: VERIFY` per entry, appended to inbox.md.
5. **plan.md** — for each plan: its tasks become a `plan:` block on the plan's first seed item
   (now the lead; other seeds get `planned_with:`), task IDs renumbered `<ITEM>.n`, add
   `verify_oracle` if missing (default honestly, not `unit`). Seeds whose source item was
   already deleted get re-created from the seed copy. Then delete plan.md.
6. **archive/** — leave existing per-run files untouched (links keep working); new runs append
   to `archive/YYYY-MM.md`. Optionally (ask) fold pre-current-month `run-*.md` files into
   month files and delete the originals.
7. **Scaffold** — create `.absol/reviews/` if absent; update `.gitignore` to ignore only
   `.absol/run.md` and track the ledger + archive.

Report: counts per step, anything skipped, and the commit hash. Revert = `git revert` that
commit.
