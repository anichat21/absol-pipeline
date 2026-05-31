# Absol Improvement Recon — 2026-05-31

Data-gathering pass over **83 run archives** (snowowl-dev 34, huntrx 39, metagross 9), the **12 skill/agent source files**, and **current Claude Code capabilities**. Mined via a dynamic workflow (16 parallel agents, ~967k tokens). Absol was *not* used to produce this — per instruction.

Goal: find what's working, what keeps breaking, and which new Claude Code primitives are worth adopting.

---

## TL;DR

- **The pipeline's *outputs* are good; its *bookkeeping* is the liability.** The highest-value findings (opus reviewer, pre-finalize smoke, test-fail auto-loop, clean crash recovery) all earn their keep. The pain is concentrated in (a) planner under-prediction, (b) "green tests, broken feature," (c) hand-rolled state/recovery machinery duplicated across skills, and (d) archive bloat.
- **Fix the cheap stuff first** — there is a pile of *drift/staleness/contradiction* bugs in the skills themselves (broken paths, a missing tool grant, "you must not edit / you do edit" contradictions, a wholesale-stale README) that cost nothing to fix and are actively misleading the agents.
- **Then adopt 3 Claude Code primitives** that map almost 1:1 onto absol's worst machinery: **structured-output schemas** (kills the JSON-in-prose parsing + bloat), **the Workflow primitive** (replaces the hand-rolled serial loop + crash recovery + heartbeat), and a **schema diet** for the archive (the context-bloat ask).
- **Don't over-parallelize.** The runs show file-touch fan-out is *systematically under-predicted* — naive parallel executors would collide constantly. Parallelism is a later, gated win (worktrees), not a quick one.

---

## 1. What works — keep it (evidence from the runs)

| Strength | Evidence |
|---|---|
| **Opus reviewer catches deep defects unit tests miss** | TSK-023 (RUN-05-09): shader injects `uFresnelPower`/`uBaseOpacity` uniforms never declared in GLSL — would fail GL compile; 15 unit tests only string-inspected the shader. Also caught the pre-wipe supersede guard defect (RUN-05-30-2). |
| **Pre-finalize smoke/verify catches regressions CI misses** | BUG-035 build breakage, iOS Safari SPA-fallback, BUG-044 blueprint-material leak, "model not exploding" — all surfaced at smoke, not in the test suite. |
| **Test-fail / user-eyes auto-loop with planner-amended brief** | RUN-05-08-2 TSK-004: double-apply-of-rest-pose diagnosed and fixed in retry-1 + 5 regression tests added. |
| **Crash recovery is clean** | RUN-05-07-2 TSK-008: API-overload crash auto-retried to green with no corrupt state. RUN-05-10: out-of-band `git restore` + state.md rollback detected and surfaced. |
| **Planner distrusts stale seeds** | RUN-05-07 DEBT-048 named 3 already-removed files; planner grepped and pivoted instead of trusting the note. |
| **Honest partial-pass reporting** | TSK-059 reported a variant-mesh branch as live-unverified (no fixture) rather than faking green. |
| **HITL clustering + session-wide pre-approval** | RUN-05-11 / 05-15: "pre-approving all HITL" removed pause friction while still logging `hitl-prompt` events. |

These are the load-bearing parts. Any redesign must preserve them.

---

## 2. The failure patterns improvements must target (29 high-severity signals)

Ranked by frequency across the corpus (signal counts: divergence 21, schema_drift 16, test_fail_loop 15, manual_intervention 13, planner_miss 11, review_findings 10, executor_error 10, finalizer_issue 9, rollback 8):

1. **Planner systematically under-predicts `files_touched`** (the #1 divergence source). RUN-05-08 alone had 4 divergence flags; consumer fan-out of schema/shape changes is discovered by executor grep, not by the plan. A recurring sub-case: `react-refresh/only-export-components` lint forces a helper out of `.tsx` into a new `.ts` module the planner never predicted (libMissingToast.ts, partLabelBridge.ts).
2. **"Green unit tests, broken feature."** The single most expensive pattern. RUN-05-30-2: 12 tasks built + unit-green (peaked 522 passing), then *fully reverted* after smoke showed the feature never engaged (wipe-registry ID-space mismatch). String-inspecting generated shader/GLSL gives false confidence (TSK-023). Live render/integration seams are invisible to the suite.
3. **Schema / contract drift is a magnet.** `EXPECTED_SCHEMA_VERSION` bumped by hand in ≥3 separate runs; a *duplicated* copy in `sync-assets.js` lagged behind (`1.2.0` vs v2) and baked an empty manifest into the nginx image — a silent end-to-end failure. Material system redesigned 4× in 6 days (ADR-0004→0006→0007→0008; PLAN-007 overwritten by PLAN-008 within a day). Frontend/backend contract mismatch on huntrx (`data.groups` vs bare list).
4. **Premise not pinned before building.** RUN-05-30-2 built+reverted 12 tasks on a wrong reading of INBOX-001 (whole-model swap vs variant-mesh wipe) *with no shaper session*. Shaping is optional exactly where it's most needed.
5. **Fix-required review findings get finalized as "done/needs-review" with a follow-up note instead of being re-executed** (TSK-023 glass uniform, TSK-020 double-write). The loop surfaces the defect, then lets it through.
6. **Manual smoke is the real test oracle but it's deferred and owned by the human.** Every huntrx pipeline run ends "user still owes manual UI smoke." snowowl's visual demo gate (citroen_ami) was chronically blocked on a human Blender re-author that itself blocked on missing material-library content.
7. **Source-of-truth confusion.** Edits landed in `public/metadata/` which is *generated* from `assets/` by `sync-assets.js` → no-ops at next build. Plugin-side LRS change shipped while runtime still read 3-tuples.
8. **Crash → rollback-to-seeds leaves code on disk un-reverted** (huntrx RUN-05-31): 4 completed + 1 partial task's edits remain, on top of ~2 weeks of unrelated uncommitted work. Recovery reverts *plans* but not the *working tree*.

**Read:** problems 1–2 are planning/verification-model problems, not orchestration bugs. The orchestrator is largely doing its job; the *plan* is too optimistic about blast radius and the *verification* trusts the wrong oracle.

---

## 3. Drift / staleness / contradiction bugs — fix now, ~free

These are in the skill source today and are actively misleading the agents. No new tech needed.

**Broken / contradictory:**
- **`skills/absol/SKILL.md:34` points at `references/schemas.md` but `skills/absol/` has no `references/` dir.** Broken path on every session open.
- **`agents/absol-executor.md` / `absol-reviewer.md` / `absol-reviewer-complex.md` are referenced by orchestrate but only `absol-planner.md` is at top-level `agents/`** (and only it is deployed to `~/.claude/agents/`). The executor/reviewer defs still live under `skills/absol-orchestrate/agents/`. Path resolution is inconsistent — the planner moved, they didn't. *(This is the staged git rename in the working tree.)*
- **Orchestrator "must not / must" contradiction:** Rule line 228 + identity line 8 say "You do NOT edit source files," but Step 4c line 133 says `micro` tier = "you do it inline. Make the edit." Pick one. (RUN-05-08 TSK-010 is the orchestrator-fixup this ambiguity invites — it self-flagged the violation.)
- **`absol-planner` is told to use `AskUserQuestion` for ADR conflicts but its `tools:` frontmatter doesn't grant it.** It silently falls back to plain-text prompting, contradicting shaper/architect.
- **`executor_tier` value space is inconsistent:** planner emits `micro|full`; scratchpad/DISCUSS introduce `inline`; `schemas.md` task enum omits `inline`. A parser keyed off the planner enum won't recognize scratchpad tasks.
- **Crash-archive naming contradiction:** `run-{run_id}.md` (line 58) vs `crashed-run-{run_id}.md` (line 90) in the same skill.
- **Hardcoded `/home/claude/.claude/skills/absol-shaper/SKILL.md`** in the planner — breaks for any other home dir; duplicates harness skill resolution.

**Duplication that guarantees future drift:**
- **Recovery state machine maintained in two places** (`absol/SKILL.md` 32–95 *and* `schemas.md` 264–296) — they already disagree on archive naming. The archive-write/reconcile algorithm is forked between `/absol` crash recovery and the finalizer.
- **Planner and architect both author `PLAN-NNN` in the same schema** with the field list restated in three places (planner inline, architect points at schemas.md, schemas.md itself).
- **No ID allocator / lock for `PLAN-NNN`/`TSK-NNN`.** Both planner and architect hand-increment by reading the file; the planner *recommends parallel per-cluster spawns* — which would race to the same ID.

**README is wholesale stale** (single most out-of-date artifact): documents `todo.md`/`todo-run.md` as live files, a skill called `/grill-me` that no longer exists (it's `absol-shaper`), tells users to invoke `/absol-orchestrate` as the front door (it's `[INTERNAL]`; `/absol` is the door), stale inbox status vocab (`new/needs-shaping/shaped/promoted` — now collapsed to `new`), and inconsistent archive naming. `absol-shaper`/`absol-planner` rules still say "never write to `todo-run.md`" (old name for `run-active.md`).

> **Recommendation:** one cleanup PLAN that (a) fixes the broken/contradictory items, (b) extracts the duplicated recovery + PLAN-schema + templates into single shared reference files, (c) rewrites the README from the live skills. This is the highest ROI work and needs no new primitives.

---

## 4. Context bloat — the "text building up from Claude's POV" ask

Confirmed across **every** project. A future agent re-reading run history pays heavily for near-zero signal. The worst offenders, concretely:

1. **Full task specs duplicated in the archive.** RUN-05-08 is 817 lines / ~32k tokens (over the 25k read cap) almost entirely because it embeds the entire plan-time `description`/`acceptance_criteria`/`verification` YAML blocks *and then* restates every task under "Reconciled tasks" with the outcome. The archive only needs the outcome.
2. **`description` (plan intent) and `summary` (as-built) restate the same change in prose**, 200–400 words each, per task. An agent re-reading needs only the summary.
3. **File-path lists appear up to 4–5× per task:** in `description` prose, `files_touched`, `files_touched_actual` (byte-identical to the former in nearly every case), the per-task `summary`, *and* the run-level "Files modified" union. SCR-05-07-6 lists `__init__.py` ~9× across 10 tasks plus the footer.
4. **Retired `shaper_notes` copied verbatim into the archive** even after the seed is gone — RUN-05-18 preserves a ~30-line in-scope/out-of-scope/pre-approved dump for a done plan; huntrx RUN-05-10/05-11 reproduce ~50–85 line seed blocks already carried by the plan.
5. **Always-zero / happy-path boilerplate on every task:** `retries: 0`, `hitl: no`, `risk: low`, `review_flag: no`, `verification_result: pass (npx tsc --noEmit clean…)`, plus the 5-line finalizer header (`Closed by absol-finalizer… Mode… Started→Ended… Duration`) on every file.
6. **The same backstory re-narrated across 5+ files** (citroen_ami / model_root-wrapper / Z-up→Y-up, re-explaining `_capture_lrs_map` each time). Cross-run standing facts ("97 pre-existing errors…", the docker-smoke paragraph) repeat near-verbatim in all 7 pipeline runs of a project.

> **Recommendation — archive schema diet** (finalizer change):
> - Archive stores **outcome only**: `id · title · status · verification · files (actual) · one-line summary · review verdict`. Drop `description`, `acceptance_criteria`, plan-time `verification`, `files_touched` (planned), and `shaper_notes` from the archive — those live in plan.md and die with it.
> - **Collapse identical `files_touched`/`files_touched_actual`** to one field; drop the run-level union (it's derivable).
> - **Omit happy-path fields entirely** — only record `retries`/`review_flag`/`risk` when non-default.
> - **Standing facts go in one place** (CONTEXT.md or a per-project `known-state` note), referenced not re-narrated.
> - This pairs naturally with structured outputs (§5): if the finalizer consumes a validated event object, it can *render* a lean archive deterministically instead of pasting prose.

---

## 5. New Claude Code capabilities → absol (prioritized)

Grounded in primitives **verified present in this session's harness**. Items marked ⚠️ are reported by web research but I could not confirm the exact shape/limits — treat as "investigate," not "build against."

### Tier 1 — adopt; high leverage, maps 1:1 onto current pain

**A. Structured-output schemas (the `agent(..., {schema})` / forced-tool-output primitive).**
- *Where:* planner → plan.md, executor → completion event, reviewer → verdict, the triage subagent's "return JSON: [{cluster_id, seed_ids, rationale}]", architect's report.
- *Why:* today these are JSON/contracts-in-prose that the orchestrator hand-parses. A validated schema kills the parser, fails fast on malformed output (cf. huntrx RUN-05-30-2's "2000+ degenerate `status: pending` lines" corrupt plan — a schema would have rejected it), and makes crash recovery deterministic (always-valid events). It also *directly enables the §4 archive diet* — the finalizer renders from typed data.
- *Risk:* keep schemas flat to start (task list, completion result, verdict). Over-tight schemas cause retry churn.

**B. Workflow primitive (pipeline / parallel / resume / journaling / budget).**
- *Where:* the entire `absol-orchestrate` serial loop + `run-active.md` event log + state.md heartbeat + the 6-state recovery machine.
- *Why:* orchestrate hand-rolls ~240 lines of state machine, event-append, liveness polling, and crash recovery. A workflow journals each step natively; "resume" replaces "grep run-active.md and reconstruct"; the **15-minute `last_event_at` heartbeat hack disappears** (it currently mis-classifies any legitimately-live >15-min task as crashed and can destroy its run-active.md). Token budgets cap runaway test-fail loops.
- *Risk:* loses the human-readable markdown orchestration plan; debugging moves to `/workflows`. Migration is real work. **Caveat for absol specifically:** absol's whole value is the *durable markdown trail* the user reads — a workflow must still emit that archive (it can, by writing the lean §4 archive as its final step). Don't throw out the paper trail to get the engine.

**C. Archive schema diet** — see §4. Independent of A/B but compounds with them.

### Tier 2 — adopt selectively

**D. `AskUserQuestion` is already used — wire it consistently.** Grant it to the planner (fix the §3 bug). Collapse the *double* plan confirmation (`/absol` activation **and** orchestrate Step 2 pre-launch ask the same thing). The migrate skill's up-to-5 sequential cohort prompts could become one structured question.

**E. `EnterPlanMode`/`ExitPlanMode` as the read-only gate.** Maps onto: planner phase (read-only by construction), `absol-architect` (read-only analysis → ADR/PLAN writes), and `absol-migrate` (Steps 1–4 read-only, Step 5 mutation). Enforces the read-only constraint at the *tool layer* instead of by agent discipline — relevant because the orchestrator-fixup violation (§2/§3) is exactly a discipline failure.

**F. Background agents (`run_in_background`) + `SendMessage`.** For the architect's whole-codebase Explore walk and the planner's per-cluster fan-out — *but only after* the ID-allocator/lock bug (§3) is fixed, or parallel planners will race PLAN-NNN ids. A builder-validator loop (executor ↔ reviewer with a structured verdict) could cut planner re-invocations.

**G. Shared "Read first" cache.** Planner, shaper, and architect each independently re-read CONTEXT.md / all ADRs / vision / roadmap / state on every cold start (expensive on opus). A single cached project-context digest (produced once per session, passed to each agent) removes the repeated read. `ToolSearch`/deferred tools also trims the ~14–16k-token upfront tool block per agent call.

### Tier 3 — defer; needs the foundations above first

**H. Worktree isolation for parallel executors.** Attractive (independent vertical slices build in parallel), but the runs prove file-touch fan-out is *under-predicted* (§2.1) — parallel executors would collide on the very files the planner failed to predict. Prerequisite: planner blast-radius accuracy + the dependency/file-overlap analysis to know what's safe to parallelize. Until then, serial is correct.

**I. ⚠️ Scheduling / Routines / `/schedule` / cron.** Web research describes cloud "Routines" and `/schedule` for unattended nightly runs (e.g. weekly `absol-architect`). Plausible and appealing as a "sync `skills/` → `~/.claude/` watcher" (the README's open to-do) and periodic tech-debt sweeps — **but** absol's state lives in local `.absol/` files; a cloud routine only sees committed repo state. Confirm the local-vs-cloud state story before relying on it. `ScheduleWakeup` (in-session, verified) is the safer near-term tool — e.g. wake to finalize a stale crashed run instead of waiting for the next `/absol`.

> **Caution on the web-research tier:** several specifics (Routine ship dates, "max 20 strict tools / 24 params," `/bg` "Agent View," "supervisor keeps idle runs alive 1 hour") come from the research agents and are **unverified**. Validate against current docs before building against any of them.

---

## 6. Recommended sequence

1. **Cleanup PLAN (Tier 0, this week):** fix §3 broken paths / contradictions / missing tool grant / executor_tier enum; extract duplicated recovery + PLAN-schema + scaffold templates into shared references; rewrite README from the live skills. Free, removes active foot-guns.
2. **Archive schema diet (§4):** finalizer change. Immediate context-cost win, sets up structured outputs.
3. **Structured outputs (§5A):** planner/executor/reviewer/finalizer contracts → validated schemas.
4. **Verification-oracle fix (addresses §2.2, the most expensive pattern):** make `verify` *fail-fast* on the pre-existing failing tests it currently ignores (vitest exits 0); require a live/integration probe (not just string-inspection) for render/GLSL/seam tasks; make fix-required review verdicts *block finalize* (or force re-execution) instead of passing through as "done + follow-up."
5. **Planner blast-radius (addresses §2.1):** have the planner grep consumer fan-out for any schema/shape/interface change before emitting `files_touched`; treat the lint-driven `.tsx`→`.ts` split as a known pattern.
6. **Workflow primitive migration (§5B):** the big one; do it after schemas exist so the workflow has typed steps to journal. Preserve the markdown archive as the workflow's final render step.
7. **Later/gated:** background fan-out (after ID-allocator fix), worktree parallelism (after blast-radius accuracy), scheduling (after verifying the local-state story).

---

*Method note: 16-agent dynamic workflow — 9 run-miners (83 files), 3 skill-source auditors, 4 capability researchers; structured-output schemas per agent; ~967k tokens / ~12 min. Run-mining and design findings are first-hand from the files; the capability tier is partly web-research and flagged where unverified.*
