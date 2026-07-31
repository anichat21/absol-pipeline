---
name: absol-orchestrate
description: "[INTERNAL] Run engine for the absol pipeline. Takes a set of ledger items + afk flag, pushes them through the execute gate (auto-filling shape/map/plan), executes tasks serially with retry and review loops, then spawns the finalizer. Invoked by /absol; don't trigger directly unless the user says '/absol-orchestrate'."
---

# absol-orchestrate

You run the build; you never author it. Data shapes:
`~/.claude/skills/absol/references/schemas.md`; conduct:
`~/.claude/skills/absol/references/doctrine.md`. Your source edits are `micro` tasks done
inline and the close-out sweep (Step 5) — mid-run you stay on plan, collecting noticed trivia
for the sweep.

Inputs from `/absol`: `project_path`, `items:` (ledger item IDs), `afk: yes|no`, and
optionally `planner_model:` (front-door-approved override — pass it to every planner spawn;
the default lane is model-doctrine's).

**Lanes** (`meta/model-doctrine.md` owns routing; `absol-codex` the how): judgment and gates
(shaping, plan approval, adjudication, commits) stay here; volume work — execution batches,
whole-diff review, bulk reading, plan drafts — routes to codex by default. Report the
routing in one line; don't ask. The agent definitions (`agents/absol-*.md`) are role
contracts — they bind whoever fills the seat, so a codex brief for a seat carries that
definition's gates and output shape.

If `.absol/run.md` already exists, recovery is `/absol`'s job — refuse and point there.

## Step 1 — The gate

Per item, check prerequisites and fill what's missing:

| Check | Missing / stale → | AFK behaviour |
|---|---|---|
| `shape:` | if intent is genuinely ambiguous, invoke `absol-shaper` inline; if the request context already settles it, skip — shape isn't ceremony. *The test:* ambiguous ⇔ you could write two shapes with different `Refuse:` or scope lines that both fit the item as written | **skip the item**; append the blocking question to it as `open:` (dated) and report it — next session's shaping starts from the question, not from scratch. Unsure whether it's ambiguous → it is; skip |
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

Header creation is a prose write; every event you append after (task-started, terminal, retry,
review, pause) goes through the toolset (`append-event`) — schemas.md §The toolset.

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
  terminal event yourself (executor's rules apply, `worker: inline`). Once ~15 tasks have
  executed this run (or context has already compacted), spawn the executor even for micro;
  protecting the conductor's context outranks saving a spawn.
- `executor_tier: full` → spawn `absol-executor` with the task entry inline in the prompt (it
  never reads run.md). When any delegated agent returns, append a `task-usage` event with the
  notification's token figure — the worker can't know its own total (schema in schemas.md).
- An agent that dies on tool/permission errors → append `task-failed` with the error as
  blocker; continue. Don't redo its work inline.

**Retry loop — re-aim, don't patch.** On `verification_result: fail` or `task-failed`: count
this task's `task-retry` events. If < 2, spawn `absol-planner` **in retry mode** (its
definition owns the diagnosis protocol). Append `task-retry` with the amendment (or re-aim),
re-execute. At 2 the patching stops, period:
- append a final `task-failed` event carrying a one-line `smell:` composed from the retry
  trail — what kept failing and what that pattern points at (event-folding takes the latest,
  and the finalizer copies it onto the item, so the next attempt starts from the diagnosis).
- attended → ask: **Solve now** (user input becomes a planner constraint; reset count) /
  **Log and continue** / **Stop the run** (finalize what's done).
- afk → mark the task failed, continue to the next task.

`task-blocked` → continue; it surfaces at finalize.

## Step 4 — Review

Collect tasks with `review_flag: yes` or `task-failed`. None → skip the per-task pass. Spawn
`absol-reviewer` with the task entries + their completion events inline (batch related tasks).

**Every run that changed code ends with one whole-diff seam review** — pre-run commit → tree
(name the commit in the prompt), regardless of flags (owner ruling 2026-07-31: near-essential;
route per model-doctrine — codex by default). Serial executors each pass their own acceptance
while the seams between tasks drift; per-task review is scoped blind to that. Seam findings
enter the same retry loop.

- `fix-required` → re-enters the retry loop with the `fix_request` (shared cap of 2 retries
  per task, verification + review combined). Exhausted → same attended/afk fork as above.
- `blocked` / `human-check` → recorded; the finalizer folds them out.

## Step 5 — Close

**Trivia sweep — fix, don't file.** Walk what the run flagged in passing (executor `summary`
mentions, your own observations): anything small, safe, and decision-free — wrong constant vs
what the user asked, missed call site, one-file cleanup — gets fixed now as a micro task with
normal events. What earns a ledger item instead is a genuinely big, first-time observation
("the whole backend under this button is on fire") — one item via note-taker, never a scatter
of one-liners. A re-run-the-run note is a wasted session; the sweep exists so it never gets
written.

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
- Read hygiene per doctrine §Working the codebase.
