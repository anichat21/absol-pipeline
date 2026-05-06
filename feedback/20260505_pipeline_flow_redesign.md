# Pipeline Flow Redesign — 2026-05-05

Working notes from a diagnosis-and-redesign session. Captures the agreed flow shape before we start editing skill files. Implementation lives in the per-skill edits that follow.

---

## Why now

Diagnosis pass on the snowowl project showed four regressions vs the backup-skills version of the pipeline:

1. **Adhoc bypass** — 4 of the last 5 snowowl runs were "Adhoc session — no formal todo-run cycle." Substantive work (Phase 2 wipe transition system, iOS safe-area, multiple bug fixes) shipped without going through shape→plan→checkpoint. The formal funnel was too heavy for hot iteration; users voted with their feet.
2. **Parallel-mode skip-verify cascade** — when the dangling-small set is non-empty, the entire run skips per-task verify, including serial tasks. RUN-2026-05-04-11 has 14/14 jobs marked `verification_result: skipped`. Pre-finalize verify becomes the only safety net; failures pile up there.
3. **Orchestrator-fixup anti-pattern** — once the orchestrator runs `micro` tier inline, it slides into fixing executor work too. RUN-2026-05-05-3 TSK-296 is logged as `worker: agent + orchestrator-fixup` — executor wrote it, orchestrator fixed the lint failure inline.
4. **Inbox starvation** — triage was merged into the planner, so there's no cheap intake classifier. INB-63 (snowowl) sat parked across multiple sessions even though BUG-033 explicitly identified it as the fix. Items rot.

Backup-skills had the right discipline — separate triage, separate fast-track, no parallel mode, orchestrator never touched files. Current has good additions on top — vertical slices, HITL clustering, AskUserQuestion checkpoints, /grill-me with pre-approvals, .absol/ layout. The redesign keeps the additions and walks back the consolidations.

---

## Entry shape — `/absol <project>`

Single command, one entry point. Brings up project summary. Then absol watches the conversation and labels it as one of three modes:

- **note-taker mode** — user is dumping ideas, bugs, observations
- **scratchpad mode** — user is asking about / fixing something specific in adhoc style
- **orchestrate mode** — user explicitly asks to run the pipeline

Pipeline only runs on explicit request. Default for adhoc work is the scratchpad — that's the answer to the "adhoc bypass" problem.

```
/absol <project>
   ↓
[summary of where the project is at]
   ↓
conversation continues; absol watches and routes:
   ↓
   ├─ "I noticed X is broken" / "feature idea: Y" / dumping notes
   │     → note-taker mode    (logs to inbox / bugs / tech-debt)
   │
   ├─ "let's fix X" / "how does Y work" / specific discussion
   │     → scratchpad mode    (logs adhoc edits as proper [job] entries, no pipeline)
   │
   └─ "run the pipeline" / "let's churn"
         → orchestrate mode   (the formal funnel)
```

### Scratchpad

Not a separate single-shot pipeline. It's a context-aware adhoc logger. Does the same logging the formal pipeline does — `[job]` entries to `todo-run.md`, archive snapshot at end of session — but doesn't force shape→plan→checkpoint. Worker tag is `scratchpad`, synthetic `task_id: SCR-{id}`. Same archive shape as orchestrate, no parser bifurcation. Snowowl's adhoc-prose archives stop being a parallel format.

---

## Note-taker as the intake triager

Note-taker is the only intake classifier. By the time orchestrate runs, everything is already categorized:

- "X is broken" → `bugs.md` (status: raw)
- "Y is fragile / smelly" → `tech-debt.md` (status: raw)
- "what if we Z" → `inbox.md` (status: raw)

Plus a `notes` field — note-taker captures the surrounding chat context at the time so future readers (grill-me, planner) have the original framing.

No separate triage agent. Ever.

---

## Inbox / plan / bugs / tech-debt — what each means

- **plan.md** — all approved (chewed by /grill-me into shaped plan-items with pre-approvals)
- **inbox.md** — mix of raw + approved
  - raw: status `new` from note-taker, never shaped
  - approved: status `shaped` from /grill-me OR from the inline shaper during orchestrate
- **bugs.md / tech-debt.md** — mostly approved (specific by nature) but can have raw vague entries

When orchestrate streams these, it labels each accordingly. User picks; orchestrate shapes the raw ones inline (1–3 q via the shaper) before planner sees them. Unresolvable raw items get parked with a "/grill-me" pointer.

---

## The orchestrate flow

```
ORCHESTRATE
═══════════

1. ASSESS
   read inbox + plan + bugs + tech-debt + state

2. STREAMBOARD
   ┌─ Plan        (always approved)
   ├─ Inbox       (label each raw / approved)
   ├─ Bugs        (label each)
   └─ Tech-debt   (label each)
   AskUserQuestion: pick subset / mix / cancel

3. INLINE SHAPE  (orchestrator)
   raw items in selection → shaper (1–3 q each)
   resolved → flip to approved
   unresolved → park "needs /grill-me", drop from this run
   
   Budget warning before shaping:
   "5 raw items selected; shaping 5 in sequence (~10–15 questions).
    Continue / drop raw items / park raw for /grill-me?"

4. INLINE CLUSTER  (orchestrator)
   group selected items by subsystem / file-overlap
     cluster A: PLAN-1 + BUG-3   (both touch xray)
     cluster B: INB-2 + DEBT-4   (both touch toast)
     cluster C: PLAN-7           (alone, that's fine)
   
   heuristic: cluster by `subsystem` first; refine by `files_touched` when
   both items have it. Items without `files_touched` cluster on subsystem
   only.

5. PLANNER LOOP
   one opus call per CLUSTER, not per item
     reads codebase region once for the whole cluster
     writes tasks for every item in the cluster
     tags small / full / review-req
     trivial items inside a cluster may emit a single task with no solutioning
   
   refuse-and-resplit: planner can return "cluster doesn't share fix"
   → orchestrator splits into singletons, retries

6. INLINE BATCH  (orchestrator)
   small tasks across all clusters → one batch
   full / review-req → individual

7. CHECKPOINT
   show: N full, M review-req, K small-batched, HITL list
   AskUserQuestion: Proceed / Adjust / Cancel

8. SERIAL EXECUTION
   for each full / review-req task in execution_order:
      HITL pause if hitl=yes
      executor agent — TDD red-green-refactor or direct-edit
      run task's verify
      fail → AskUserQuestion: Retry / Skip / Abort
   small tasks accumulate (not executed yet)

9. SMALL-BATCH FLUSH
   executor applies the batch
   ONE verify across the batch
   fail → bisect or mark batch failed; surface in finalize summary

10. REVIEW
    review-req tasks: always
    review_flag=yes / failed: selectively
    routine → reviewer (sonnet); ARCH / high-risk → reviewer-complex (opus)

11. FINALIZE CHECKPOINT
    pre-finalize verify/smoke (per CLAUDE.md Pipeline Commands)
    AskUserQuestion: Finalize / Stop
    absol-finalizer runs: state.md, archive, compaction
```

---

## Two grouping passes, different jobs

```
ITEM CLUSTERING  (before planner)
   group selected items by shared subsystem / overlapping files
   → planner runs once per cluster, not per item
   → solves "two bugs side-by-side" context-bloat
   
TASK BATCHING    (after planner)
   group small tasks into a single batch
   → one verify at end, not per-task
   → the smart-serial replacement for parallel-mode
```

Both done inline by the orchestrator. Cheap heuristics, no codebase reading. Orchestrator stays a conductor; the heavy thinking still happens in planner / executor / reviewer.

---

## Roles — clearer

The reason planner felt overloaded is it was secretly doing four jobs. Pulled apart:

| Job | Description | Where it lives |
|---|---|---|
| **Shape** | Vague request → concrete-enough description (1–3 q, light) | Shaper (inline in chat, in orchestrate) |
| **Grill** | Idea → deeply locked plan-item with pre-approvals | /grill-me (skill, separate invocation) |
| **Solution** | Shaped item + codebase → "this is HOW we build it" | Planner (opus, agent) |
| **Decompose** | Solution → vertical-slice tasks | Planner (same call) |
| **Size** | Each task → small / full / review-required | Planner (same call, cheap once you know the slice) |
| **Implement** | One task → code change | Executor (sonnet, agent) |
| **Review** | Check the work | Reviewer / Reviewer-complex |

Planner = solution writer + decomposer + sizer. Three things, but tightly coupled — knowing the solution tells you the slices, and the slices tell you their size. Backup-style "separate triage" never sat right because you can't size a task without knowing the slice.

Planner is the **last word on the build**. That's its identity.

### Does planner shape small bugs?

Not really. Spectrum:

| Item | Path |
|---|---|
| Small bug ("change `<` to `<=` in `auth.ts`") | Direct to executor as a single task. Planner skipped — there's no solution to write. |
| Medium bug ("xray wipe pops in") | Planner reads code, identifies root cause, writes 1–2 tasks |
| Big bug / feature / ARCH | Planner does full solutioning, writes N tasks with dependencies |

Planner is invoked when there's a real solution to design.

---

## What this fixes vs current

| Concern | Fix |
|---|---|
| Adhoc bypass | Scratchpad becomes the default for hot iteration; it logs as first-class jobs |
| Planner re-eats context per item | Cluster first → planner reads each region once |
| Two bugs side-by-side | Same cluster, one planner call, joint solution |
| Inbox raw items rotting | Note-taker classifies on the way in; inline shape on selection |
| Triage as separate role | Killed entirely; note-taker does intake, planner does sizing |
| Parallel-mode skip-verify | Killed; serial throughout, full-tier tasks always verify |
| Small-task overhead | Single batch + single verify at end |
| Orchestrator-fixup pattern | Reinstate "orchestrator does not edit source files" rule |

---

## Locked decisions

1. **Cluster heuristic** — subsystem first; refine by `files_touched` when both items have it. Items without `files_touched` cluster on subsystem only. Misclusters surface as planner refuse-and-resplit.

2. **Inline shape budget** — count raw items in selection at the streamboard; warn the user before shaping starts ("5 raw items, ~10–15 questions"). Don't surprise them with a wall of questions.

3. **Refuse-and-resplit threshold** — when planner says "this cluster doesn't share a fix," orchestrator just splits into singletons. No re-clustering with smaller groups; that's overengineering for an edge case.

4. **Note-taker is the only intake classifier** — no triage agent ever returns. bugs / tech-debt / inbox routing happens at note-take time.

5. **Scratchpad logs as `[job]` entries** — same archive shape as orchestrate, `worker: scratchpad`, synthetic `task_id: SCR-{id}`. No parallel archive format.

6. **Serial execution everywhere** — parallel-mode and dangling-small fanout are removed entirely. Smart-serial (small-batch flush at end) replaces them.

7. **Orchestrator does not edit source files** — verification failure → re-spawn executor or mark `failed`. The "orchestrator-fixup" worker tag stops appearing.

---

## Phasing

Five independent fixes. Smallest blast radius first so each is validated before committing to the next.

| Phase | Change | Files touched |
|---|---|---|
| 1 | Kill parallel-mode skip-verify; restore serial-with-batching | `absol-orchestrate/SKILL.md`, `absol-executor.md` |
| 2 | Reinstate "orchestrator does not edit files"; tighten or kill `micro` tier | `absol-orchestrate/SKILL.md`, `absol-executor.md` |
| 3 | Split planner into per-cluster invocation; remove intake-triage from planner | `absol-planner.md`, `absol-orchestrate/SKILL.md` |
| 4 | Add inline-cluster + inline-batch to orchestrator; small-batch flush step | `absol-orchestrate/SKILL.md` |
| 5 | New `/absol <project>` entry skill with mode-routing + scratchpad | new skill: `absol`, new skill: `absol-scratchpad` |
| 6 | Note-taker `notes` field; raw/approved split on inbox | `note-taker/SKILL.md`, schema doc |
| 7 | Grill-me confidence-skip on dominant recommendations | `grill-me/SKILL.md` |

Phases 5–7 are smaller and can interleave with the others.

Each phase is one short session: edit → sync via symlink → snowowl test run → commit if good.

---

## Open questions (not blocking implementation)

- **Cluster size cap.** If user picks 30 items and they all land in one cluster ("everything touches the scene module"), do we cap cluster size at N items per planner call? Probably yes, but pick N empirically after a few runs.

- **Scratchpad ↔ orchestrate handoff.** If a scratchpad session uncovers something worth a real plan-item, does scratchpad mode know how to call note-taker mid-flight? Probably just a pointer in the closing summary: *"this looked planner-shaped — consider /absol orchestrate or /grill-me on it."*

- **`/absol <project>` summary content.** What goes in the project summary at entry? Last session, in-progress, parked items, raw count by stream? Keep it tight — it's an entry banner, not a status report.

- **Ungrilled inbox items at finalize.** Should the finalizer surface "N inbox items still unshaped, run /grill-me" the way the current finalizer does? Yes. Keep that.
