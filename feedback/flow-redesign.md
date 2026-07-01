# Absol flow redesign — converged model (2026-07-01)

Companion to `corpus-review-2026-07.md`. Converged after discussion: **item-centric ledger with
an execute gate.** Modular skills stay, stored plans stay, no big migrate.

## The model

One center artifact — the **item** — living where items live today (`inbox.md` / `bugs.md` /
`tech-debt.md`; that's the ledger, sharded by type). Every tool that touches an item **grows it
in place**; nothing is copied elsewhere, no status is stored anywhere else.

```
- [#041] toast doesn't dismiss                       ← note-taker (capture)
  - type: bug · subsystem: ui
  - shape: |                                         ← shaper / transcribed from chat
      In: dismiss on click + 5s timeout. Out: queueing. Refuse: multi-toast stacking.
  - map: |                                           ← research (auto)
      Entry: toastStore.show(). Consumers: 3 call sites. Mirror: bannerStore.
  - plan: |                                          ← planner (auto; tasks, stored)
      TSK-1 repro: failing test for stuck toast (reality contact first)
      TSK-2 fix dismiss handler + timeout, files: src/ui/toast.ts, …
  - prior: archive/2026-06.md#RUN-…                  ← only if an earlier run touched it
```

- **Conversation is intake.** You talk; note-taker captures new items; anything decisive you say
  about an existing item gets transcribed into its `shape:`. Items fill up across sessions until
  they're primed. You never edit the ledger by hand — every block has exactly one tool that
  writes it.
- **Grouped work:** the planner writes the `plan:` on a lead item with `covers: #42, #43`;
  covered items get one pointer line. One plan, no seed copies.
- **plan.md is deleted.** The plan block *is* the stored plan — plan-now-run-later survives
  without the copy + `status: promoted` flip + prune cycle. "What's ready to run" is derived:
  items with a plan.

## The execute gate

`run #1 #2 #3` (or "run the bugs", or a scheduled sweep) pushes items at the gate. The gate
checks prerequisites and **auto-fills what's missing** on the way through:

| Prerequisite | Missing → | Needs you? |
|---|---|---|
| `shape:` | shaper fills it — from chat context if unambiguous, questions only for real gaps | **the only one that can** |
| `map:` | research fan-out, automatic | no |
| `plan:` | planner, automatic (simplicity gate, reality-contact task 1) | no |
| freshness | `git log --since=<block date> -- <files>` per block; moved files → re-map/amend just those | no |

- **Attended run:** gaps get filled inline — it shapes #3 with you right there, then executes.
- **AFK / scheduled run:** only gate-passing items execute; genuinely ambiguous unshaped items
  are **skipped and reported** ("#3 skipped — needs shaping: X"), never guessed at.

So the lifecycle is: *messages prime items → a sweep processes everything primed → outcomes
land in the archive.* Priming is conversational; sweeping is automatable.

## Execution + close (unchanged from the revised proposal)

- `run.md` (transient) holds the run header + append-only events. Exists ⇔ run live; mtime =
  liveness. Events are churn — they never touch the ledger mid-run.
- Executor/reviewer get their task inline in the prompt; append events only. One reviewer,
  models inherited.
- Finalize: append the outcome block to `archive/YYYY-MM.md`, delete `run.md`, then fold results
  back into the ledger — **done items are deleted** (the archive is their record); failed or
  partial items stay, gaining a `prior:` anchor; human-oracle work appends a `verify` item you
  clear next session.
- Crash: `run.md` exists + stale → finalize as crashed. The ledger was never touched mid-run, so
  it's already correct — no reconcilers, no orphan states, no drift.

## Bookkeeping is fully tool-owned

Complete write surface — every one automated:

| Write | Owner |
|---|---|
| append item | note-taker |
| grow `shape:` | shaper (or transcription from your messages) |
| grow `map:` | research |
| grow `plan:` | planner |
| create run.md / append events | orchestrate + agents |
| append archive block · delete run.md · delete/annotate items | finalizer |

Your manual surface is decisions only: answer real shaping questions, launch or schedule runs,
confirm owed human smoke. Everything else — statuses, queues, liveness, history, cleanup — is
either a derived view (banner greps the ledger) or a tool's write. Zero hand bookkeeping.

## Shaper question contract (unchanged)

- Ask only when the answer changes the plan AND ≥2 options are genuinely defensible; otherwise
  state the assumption, batch-confirm at the end.
- Every option arguable in one sentence; two real options beat three padded ones — never fill
  slots. Recommendation is option 1.

## Adoption — still incremental, still no migrate

Same rule as before: new skills read old + new shapes, write only new; **no step reshapes
existing project data**; revert = `git revert` (symlinks make it instant).

| Step | Change | Data migration |
|---|---|---|
| 1 | Skills-only quality: fix-required contradiction, merge reviewers, unpin executor, drop haiku triage, shaper contract, planner gates, AFK flag | none |
| 2 | Liveness = run.md existence + mtime; stop writing `## Active Run`/`## Pause`/double timestamps | none |
| 3 | run.md = events only (no tasks snapshot) | none — transient file |
| 4 | Planner writes `plan:` blocks on items; stops flipping `status: promoted`; still *reads* legacy plan.md if present | none — old plans run out naturally |
| 5 | Archive → append-only `archive/YYYY-MM.md` forward; old per-run files untouched | none |

Trial each step on one project (huntrx or shearwater) before the rest. `absol-migrate` stays an
optional residue cleanup, never a prerequisite.
