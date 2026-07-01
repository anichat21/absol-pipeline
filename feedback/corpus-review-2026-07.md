# Absol corpus review — brevity, doc flow, logic (2026-07-01)

Reviewed: all 11 skills + 4 agent definitions + `schemas.md` (~2,800 lines), and the 125 archived
runs across huntrx, metagross, shearwater, snowowl/snowowl-dev, and The distillery.

## 1. Verbosity — where the lines go

| File | Lines | | File | Lines |
|---|---|---|---|---|
| absol | 284 | | absol-research | 140 |
| absol-newproject | 269 | | absol-executor (agent) | 139 |
| absol-orchestrate | 219 | | absol-shaper | 129 |
| absol-planner (agent) | 214 | | absol-migrate | 87 |
| absol-scratchpad | 211 | | absol-reviewer (agent) | 70 |
| absol-architect | 197 | | note-taker | 66 |
| absol-finalizer | 197 | | absol-reviewer-complex (agent) | 65 |
| absol-docs | 159 | | schemas.md | 352 |

The length is mostly **duplication, not content**. The same fact is stated in up to five places:

- The `[task]` schema: planner, schemas.md, scratchpad (SCR variant), run-active snapshot spec.
- Event-block shapes: executor, scratchpad, both reviewers, schemas.md.
- `verify_oracle` semantics: planner, executor, orchestrate, finalizer, schemas.md.
- TDD / direct-edit execution rules: verbatim in executor **and** scratchpad.
- Vertical-slice rule: planner, architect, executor, schemas.md.
- Test-fail loop: absol, orchestrate, schemas.md.
- `absol-reviewer` vs `absol-reviewer-complex`: ~85% identical files.
- Crash/recovery: absol (full matrix) + a re-implementation of the finalizer's archive step inline.

Second cost: **frontmatter descriptions load into every session**, invoked or not. The absol
descriptions total ~1,100 words; absol-scratchpad's alone is ~170 words. That's paid on every
conversation on this machine.

Third cost: rationale prose ("This exists because…", "The reason: …") woven through operating
instructions. Good design notes, wrong home — they belong in the README, once.

**Proposed rule: one fact, one home.**
- `schemas.md` is the only place a schema is written out. Skills point at it.
- An agent definition inlines only the event block *it writes* (agents don't get reference files
  for free), nothing else.
- Rationale lives in README; SKILL.md files carry instructions only.
- Merge the two reviewers into one file (see §5).
- Scratchpad's execution rules become one line: "same rules as absol-executor's Execute/Verify."
- Description budget: ≤50 words each.

Realistic target after the pass: **~2,800 → ~1,400 lines** with zero behavior loss — and §2 shows
the duplication isn't just cost, it's actively producing bugs.

## 2. Logic inspection — real contradictions found

1. **The fix-required contract contradicts itself.** `absol-orchestrate` Step 5 (updated by the
   2026-06-15 verification-oracle fixes): *"fix-required re-executes in-run — it is not deferred."*
   But both reviewer files still say the old thing: *"fix-required tasks are handled by the next
   planning cycle (user-initiated via /absol)."* The June fix updated one of three copies. This is
   the concrete proof of §1: duplicated facts drift into contradictions.
2. **Finalizer disagrees with itself on `needs-review`.** Step 2's table produces `needs-review`
   for unresolved review verdicts; Step 6 claims needs-review "should not appear here" (crash-only).
   Both can't be right — an exhausted fix-required + "Log and finalise" lands exactly there.
3. **Retry budget is ambiguous across layers.** Executor: "two failed verification attempts →
   task-failed." Orchestrator: 2 `task-retry` loops. Net: up to ~6 verification attempts per task,
   stated nowhere.
4. **Model names are baked into data records.** Events carry `worker: sonnet`, `reviewer: sonnet`.
   Records should carry roles (`worker: executor`); models are deployment detail (see §5).
5. **Two different project-resolution rules.** `/absol` matches a folder name under `projects/`;
   note-taker walks up from cwd looking for `state.md`.
6. **`archive/` tracking drifts per project.** README says archive is git-tracked ("safety net");
   The distillery gitignores it. Pick one and let `/absol-newproject` enforce it.

## 3. What 125 archived runs actually show

The machinery works: run completion is ~95–100% in every project, crash recovery recovered the
runs it met (huntrx SCR-2026-06-07, distillery RUN-2026-06-13-3), unattended overnight resume
worked (huntrx RUN-2026-05-31-4). **The expensive failures are all planner-judgment failures:**

- **Overbuild** — distillery RUN-2026-06-30: a FBX parser planned as 15 tasks (scored-fusion
  classifier, fuzzy matching); 8 built green before task 9 touched real files; ~4h torn down.
  The retro already names it: *"Nothing in the flow asks 'what's the simplest design that clears
  the bar?'"*
- **Misdiagnosis** — shearwater BUG-001: a felt camera "nudge" planned as a full Catmull-Rom
  spline rebuild (261 tests, ~6h across two runs). Real cause: one `overshoot=0.3` constant.
  Both runs reverted.
- **Wrong premise** — snowowl-dev RUN-2026-05-30-2: 12 tasks, 522 tests green, fully reverted
  (wipe-registry keyed wrong; architecture premise never validated).
- **Thin on integration** — shearwater RUN-2026-06-11: 9/9 tasks build-and-test green, opus review
  found 4 dead-at-runtime defects; metagross TSK-519: three review rounds, each catching a real bug
  that green grid-aligned fixtures missed.

So "the planner is dumb" has a precise shape: **it commits fully to its first framing and meets
reality too late** — over-delivering machinery, under-delivering working integration. Same root,
both directions.

**Reviewers:** the sonnet/opus split runs as designed, but virtually every meaningful catch in the
archives is opus (rotation math 180° off, dropped SQLite index, dead-at-runtime cluster, cache
poisoning); sonnet verdicts cluster on routine approvals. The notable misses (bloom shader
approved broken, WebGL context leak) were opus too — so the tier split buys little and costs a
second agent file plus routing logic.

**Context blowups:** the 5MB-JSON/maxed-context run does **not appear in any archive** — archives
are outcome-only, so agent-behavior pathology is invisible to the feedback loop. The one recorded
blowup is compute, not context (distillery RUN-2026-06-13-3: infinite sampler loop → OOM). Either
way, nothing in the corpus tells any agent how to treat large data files. Fix in §5.

**Doc churn (evidence the movement system is messy):** huntrx archive carries three naming
generations (`RUN-*.md`, `run-RUN-*.md`, `runs-2026-05.md` + stray `inbox-RUN-*`,
`scr-*-postrun-patches.md`); metagross needed dedicated repair sessions for cross-references and
had inbox.md corrupted by concurrent planner writes (RUN-2026-05-31-3 finalize repaired it);
snowowl-dev needed a manual mid-run state.md re-patch after a rollback. None fatal — but all of it
is maintenance of duplicated state.

## 4. The document movement system — yes, it's messy. Proposal.

Today one unit of work exists in **five shapes** (note → plan seed → run-active snapshot task →
events → archive line), with flags synced in both directions (`status: promoted`/`promoted_to` ↔
plan existence) and the same liveness fact written to two files after **every** event
(`last_event_at` in run-active.md *and* state.md). All the healing machinery — the 6-state
recovery matrix, drift states A/B, the orphaned-note reconciler, the finalizer idempotency check,
the inline crash-archive in `/absol` — exists solely to repair that duplication.

**Principle: store a fact once, derive the rest.** Five changes, each deleting machinery:

1. **Delete `## Active Run` and `## Pause` from state.md.** run-active.md's *existence* means a
   run is open; its *mtime* is the liveness signal (appends update it for free); a pause is just
   the last event in the log. Recovery matrix drops from 6 states to 3 (clean / live / stale →
   recover); drift A/B become impossible by construction; two cross-file writes per event
   disappear. state.md becomes purely the finalizer's truth snapshot.
2. **Never mutate notes' status.** Delete `status: promoted`/demotion flows. A note is "planned"
   iff its ID appears in a plan.md seed — derived by the banner with a grep, not stored. Notes are
   written once (note-taker), enriched in place (shaper/research), deleted at completion
   (finalizer). A crashed scratchpad leaves the note correct *by default*; the orphan-reconciler
   pass is deleted.
3. **Delete the Tasks snapshot from run-active.md.** The run log becomes header + events only.
   Tasks live in plan.md alone (frozen while a run is open — already the rule); the orchestrator
   passes entries inline to agents as it already does; crash recovery joins events to plan.md by
   TSK id. Scratchpad task-started events carry a `title:` so SCR work needs no snapshot either.
4. **One append-only archive file per month** (`archive/2026-07.md`): finalizer appends the lean
   run block directly. No per-run files, no rollup step, no renames, no deletions, no
   `sessions-*.md` (state.md already keeps Last Session). The naming chaos in §3 can't recur.
   `prior_work:` links become anchors (`archive/2026-06.md#RUN-…`).
5. **One close path.** Crash recovery invokes the finalizer with `crashed: yes` instead of
   `/absol` re-implementing the archive step inline.

End state — files: 3 note files, plan.md, run-active.md (events), archive/YYYY-MM.md, state.md.
Mutations: append note / enrich note / delete note; append plan / delete plan; append event;
append archive block; rewrite state.md. Nothing is flipped, synced, or healed. Ship it as an
`absol-migrate` delta.

## 5. Agents, models, context

**"Why is there a sonnet reviewer?"** Cost-tiering — and the archives say it isn't earning it
(§3). Merge to a single `absol-reviewer`, **no pinned model** (inherits the session — opus for
you), delete reviewer-complex and the orchestrator's routing table. Reviews only run on flagged
tasks, so the cost delta is small.

**Executor is pinned sonnet** while the planner is opus — the actual code-writer is the weakest
model in the chain. That is exactly "implementations are always not enough." Unpin it (inherit)
or pin opus for `full` tier; `micro` stays inline. General rule: **stop pinning models in
frontmatter** — inherit by default, pin only where a cheap model is a deliberate choice, and keep
model names out of event records (§2.4).

**Haiku triage subagent:** delete. Grouping a handful of seeds is one thought for the session
model; the planner's `human-required` verdict already backstops bad grouping.

**Context preservation** (the 5MB-JSON class of failure):
- Add one read-hygiene line to executor, planner, and research reader prompts: *"Before reading
  any data/generated file, check its size; >256 KB → sample with `head`/`jq`/`grep`, never read
  whole."*
- Enforce it where it can't be forgotten: a PreToolUse hook in workspace settings that blocks
  `Read` on files >1 MB with that suggestion. Models forget; hooks don't.
- **Run the finalizer as a spawned agent, not inline.** It executes at the end of the longest
  sessions — precisely when the orchestrator's context is fullest — and needs only `.absol/`
  files. Orchestrate keeps the checkpoint questions, then delegates the walk.
- Keep as-is: inline task passing and append-only events are the right arrangement; don't touch.

**AFK mode.** You run the pipeline mostly AFK, but two AskUserQuestion gates assume presence:
retry exhaustion and the finalize checkpoint. Add an `afk` flag at launch: exhaustion → log and
continue; end of run → auto-verify (+smoke if declared) → auto-finalize → leave the report.
huntrx RUN-2026-05-31-4 already invented this informally ("unattended policy").

## 6. Planner fixes (beyond the model)

The distillery retro's recommendations, adopted as ~10 lines across two files:

1. **Simplicity gate** (planner): the plan Summary must state the simplest design that clears the
   bar; >8 tasks requires a one-line justification of what the extra tasks buy.
2. **Reality contact first** (planner): the end-to-end/acceptance probe is task 1–2, never task 9.
3. **Falsify before fixing** (planner): for BUG seeds, task 1 reproduces or falsifies the
   diagnosis before anything is built (the shearwater lesson).
4. **Failure boundary in shaping** (shaper): ask "what do we hard-fail/refuse?" next to "what do
   we build."

Note brevity and quality are not in tension here — these four rules cost fewer lines than any one
of the duplicated schema blocks being deleted in §1.

## 7. Proposed new skill: absol-explain (draft — not installed)

```markdown
---
name: absol-explain
description: Explains absol briefly and simply — what it is, the three modes, the files, who writes what. Use when the user says '/absol-explain', 'explain absol', 'what is absol', or a fresh context needs a one-minute orientation.
---

# absol-explain

Explain absol in under a minute of reading. No file dumps, no schemas — the concept:

**absol** is a project workflow for Claude Code: ideas go in as notes, work comes out as
reviewed, archived runs.

**Three modes**, routed by `/absol`:

- **note-taker** — capture a thought → `inbox.md` / `bugs.md` / `tech-debt.md`.
- **scratchpad** — interactive work; the user drives live. Logged and archived like any run.
- **pipeline** — unattended AFK build: shape intent → research blast radius → plan → execute
  serially → review flagged work → finalize.

**Files** (in `.absol/`): notes (intake) → `plan.md` (designed tasks) → `run-active.md` (live
event log) → `archive/` (outcome record). At root: `state.md` (current-truth snapshot); in
`.absol/`: `CONTEXT.md` (vocabulary) and `adr/` (decisions).

**One principle throughout:** decisions are settled with the human up front (shaping); execution
runs unattended; the finalizer leaves lean, durable records.

If the user asked about one specific piece, answer just that, in the same plain register. If they
need the real spec, point at that piece's SKILL.md instead of paraphrasing it.
```

## Suggested order of work

1. Fix the fix-required contradiction in both reviewer files (2 lines, today).
2. Merge reviewers; unpin executor; drop haiku triage. (§5)
3. Brevity pass under "one fact, one home" + description trims. (§1)
4. Planner/shaper judgment rules. (§6)
5. Doc-movement simplification as an absol-migrate release. (§4)
6. Read-size hook + read-hygiene lines; finalizer-as-agent; AFK flag. (§5)
7. Install absol-explain. (§7)
