---
name: absol-orchestrate
description: "[INTERNAL] Run engine for the absol pipeline. Takes a set of ledger items + afk flag, pushes them through the execute gate (auto-filling shape/map/plan), executes tasks serially with retry and review loops, then spawns the finalizer. Invoked by /absol; don't trigger directly unless the user says '/absol-orchestrate'."
---

# absol-orchestrate

You run the build; you never author it. Data shapes:
`~/.claude/skills/absol/references/schemas.md`. Your only source edits are `micro` tasks done
inline — never off-plan fixes to things you notice (report them for note-taker instead).

Inputs from `/absol`: `project_path`, `items:` (ledger item IDs), `afk: yes|no`.

If `.absol/run.md` already exists, recovery is `/absol`'s job — refuse and point there.

## Step 1 — The gate

Per item, check prerequisites and fill what's missing:

| Check | Missing / stale → | AFK behaviour |
|---|---|---|
| `shape:` | if intent is genuinely ambiguous, invoke `absol-shaper` inline; if the request context already settles it, skip — shape isn't ceremony | **skip the item**; append the blocking question to it as `open:` (dated) and report it — next session's shaping starts from the question, not from scratch |
| `map:` | invoke `absol-research` on the unmapped items (it scales itself; trivial items get a two-line map) | same, automatic |
| `plan:` | group + spawn planner (below) | same, automatic |
| freshness | per task: `git log --since=<block date> -- <files_touched>`; touched files → re-map those items, then spawn planner to amend just the affected tasks | same, automatic |

**Grouping (inline — no subagent):** items sharing a subsystem or overlapping files form one
group with a lead; the rest are singletons. Spawn `absol-planner` per group **sequentially**
(parallel planners appending to the same intake file corrupt it), passing the full item entries
inline. `human-required` verdict → surface to `/absol`'s regrouping prompt (attended) or skip
the group with the verdict in the report (afk).

## Step 2 — Open

Generate run_id `RUN-{YYYY-MM-DD}` (`-2`, `-3` on collision — check `archive/`). Create
`.absol/run.md` with the header (mode, afk, items, started). The file's existence is the lock;
its mtime is the heartbeat — write no timestamps anywhere else.

**Pre-run commit** (if the project is a git repo; otherwise skip silently): commit everything —
`absol: pre-run {run_id} snapshot`. This is the rollback anchor for the whole run; a dirty tree
gets snapshotted too (that's the point). Never push — the user pushes, or says to.

Print a one-line launch banner. Attended: confirm once (**Proceed** / **Cancel** — on cancel,
delete run.md). AFK: proceed.

## Step 3 — Execute (serial)

Walk all primed items' tasks by `execution_order`, dependencies first. Per task:

- **Pause check** (attended only): user said "pause"/"hold on" → finish the current task,
  append a `pause` event with `next_task`, stop. `/absol` resumes.
- `executor_tier: micro` → do it inline: edit, run `verification`, append `task-started` +
  terminal event yourself (executor's rules apply, `worker: inline`). If your own context is
  getting heavy — long run, many tasks — spawn the executor even for micro; protecting the
  conductor's context outranks saving a spawn.
- `executor_tier: full` → spawn `absol-executor` with the task entry inline in the prompt (it
  never reads run.md).
- An agent that dies on tool/permission errors → append `task-failed` with the error as
  blocker; continue. Don't redo its work inline.

**Retry loop — re-aim, don't patch.** On `verification_result: fail` or `task-failed`: count
this task's `task-retry` events. If < 2, spawn `absol-planner` **in retry mode** (its
definition has the protocol): it must answer *"is this the right way?"* before touching the
task — a mechanical slip gets an amendment; a wrong approach gets a redesigned task or a
`blocked` verdict with the smell named. An amendment that layers a workaround on the previous
attempt is forbidden — that's the rabbit hole. Append `task-retry` with the amendment (or
re-aim), re-execute. At 2 the patching stops, period:
- compose a one-line `smell:` from the retry trail (what kept failing and what that pattern
  points at) onto the final `task-failed` event — the finalizer folds it onto the item so the
  next attempt starts from the diagnosis, not the patch trail.
- attended → ask: **Solve now** (user input becomes a planner constraint; reset count) /
  **Log and continue** / **Stop the run** (finalize what's done).
- afk → mark the task failed, continue to the next task.

`task-blocked` → continue; it surfaces at finalize.

## Step 4 — Review

Collect tasks with `review_flag: yes` or `task-failed`. None → skip. Spawn `absol-reviewer`
with the task entries + their completion events inline (batch related tasks).

- `fix-required` → re-enters the retry loop with the `fix_request` (shared cap of 2 retries
  per task, verification + review combined). Exhausted → same attended/afk fork as above.
- `blocked` / `human-check` → recorded; the finalizer folds them out.

## Step 5 — Close

Read `CLAUDE.md ## Pipeline Commands` for `verify:` / `smoke:` (infer a sensible verify for
the stack if absent).

- Attended: ask once — run **verify + smoke** (recommended) / verify / skip. If a check fails,
  show it and ask **Finalize anyway** / **Stop** (stop leaves run.md; `/absol` recovers).
- AFK: run verify (and smoke if declared) automatically; failures go in the report; always
  finalize.

Spawn `absol-finalizer` (agent) with project path + run_id — it archives, folds the ledger,
rewrites state.md, deletes run.md, and makes the **post-run commit**. Relay its report
verbatim; if anything failed, is blocked, or owes smoke, that's the headline, not a footnote.

**An AFK run ends the turn here — completely.** The report is the final message; no trailing
questions, ever (an unanswered question parks the session past the prompt-cache TTL, so every
later answer pays a full-context re-read). Everything that wanted an answer is logged: `open:`
on skipped items, `smell:` on failed ones, VERIFY items for owed smoke. The next `/absol`
banner surfaces all of it.

## Rules

- Serial execution; the ledger is read-only for you once the run starts (agents write only
  run.md events; the finalizer does all fold-back).
- Unattended means unattended: in afk mode nothing blocks on a question — every fork has the
  logged default above.
- Data/generated files: check size first; over 256 KB, sample with `head`/`grep`/`jq`.
