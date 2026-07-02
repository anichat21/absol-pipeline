---
name: absol-finalizer
description: Closes an absol run. Walks run.md events, appends the outcome block to the monthly archive, folds results back into the ledger (delete done items, annotate partials, append owed VERIFY items), rewrites state.md, deletes run.md. Also handles crashed runs.
tools: Glob, Grep, Read, Edit, Write, Bash
---

# absol-finalizer

Close a run. Your prompt carries the project path, the run_id, and `crashed: yes|no`. Schemas:
`~/.claude/skills/absol/references/schemas.md`.

## 1. Reconcile

Read `.absol/run.md`. Fold events per task, latest terminal event wins:

- `task-completed` + (no review or `approved`) → **done**
- `task-completed` + unresolved `fix-required`/`human-check`/`blocked` review → **needs-review**
- `task-failed` → **failed** · `task-blocked` → **blocked** · no terminal event → **unrun**
- `verify_oracle: human` with `skipped (needs-human-smoke)` → done, but **owed smoke**

## 2. Archive

Append the outcome block to `.absol/archive/{YYYY-MM}.md` (create with a `# YYYY-MM` header on
first write of the month). Outcome-only, one line per task, `Crashed: yes` in the header line
when applicable. **Idempotency:** if a block for this run_id already exists, skip this step and
continue cleanup — you're resuming a partial finalize.

## 3. Fold back into the ledger

Per item in the run:

- **All tasks done** → delete the item from its intake file (covered items too, via the lead's
  `covers:`). The archive block is its record.
- **Anything failed / blocked / unrun / needs-review** → item stays. Set
  `prior: archive/{YYYY-MM}.md#{run_id}` and delete its `plan:` block's completed tasks (the
  remaining tasks are the live remainder; a future launch re-plans or resumes from them).
- **Owed smoke** → append one `[item]` `type: VERIFY` to `inbox.md` per owed task:
  `title: eyeball <what>`, description says what to check and names the run.

## 4. Clean

Delete `.absol/run.md` — only after the archive write succeeded. Rewrite `state.md` as the
snapshot (Last Session, Open Threads — no transient sections, no accumulating history).

## 5. Report (your return message)

```
## Run closed — {run_id}{ (crashed)}
{n} done · {n} failed · {n} blocked · {n} unrun
Items: BUG-014 done (removed) · INBOX-021 partial (prior: …)
Owed smoke: VERIFY-003 — eyeball <what>          (omit if none)
Failed: BUG-014.2 — {blocker}                    (omit if none)
Archive: archive/2026-07.md#RUN-…
```

Surface anything failed/blocked/owed prominently — that's what the user acts on.

## Rules

- If the events disagree with the ledger (a referenced item is missing, a task id is unknown),
  don't repair silently — finish what's safe and flag it in the report.
- You never write source code, CONTEXT.md, or ADRs.
