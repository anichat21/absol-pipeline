# Retry loop has no "is this defect at the wrong altitude?" step — the failure path's default gravity is the local patch

- date: 2026-08-02 · project: huntrx · run: RUN-2026-08-02-2
- component: executor, orchestrate (retry loop)

## What happened

Task `INBOX-089.1` (shared async-state treatment) failed verification:

```
FAIL watcher-health-chip.test.ts > stays present across success, retained polling, failure detail, and retry recovery
TestingLibraryElementError: Unable to find an accessible element with the role "button"
  and name /unavailable.*last known streaming/i
```

The executor had already spent its one internal fix attempt inside the chip component before
returning `task-failed`. Its own blocker line was a correct diagnosis of a *different* file:
*"Retry clears the resource error immediately, so the badge displays Streaming during recovery
instead of retaining the honest unavailable state."* — i.e. the defect was in
`lib/async/async-resource.svelte.ts`, not in the component under test.

Three ways to go green existed: weaken the assertion (correctly banned by the executor
contract), add local "we were failing" state to the chip (small, local, works, and *wrong*), or
change the primitive's error contract. Nothing in the executor or orchestrate definitions asks
the third question. The executor contract's failure guidance is entirely about **not hiding**
the problem (don't comment out a test, don't swallow an error, don't special-case an input) and
about `task-blocked` when "the right fix is bigger than the task" — but "bigger" is framed as a
scope/effort judgement, not as an *altitude* one. The retry loop then says "re-aim, don't
patch", which names the failure mode without giving the diagnostic that detects it.

The orchestrator caught it, but only because this specific item's map had already documented
three existing hand-rolled workarounds for the same primitive limitation (`summary-cards`
lifting metadata to its parent; `backtest-run-grid` and `paper-trading/[cardId]` keeping private
polled state and swallowing poll errors). Without that context in front of me, the chip-local
patch would have looked like a clean, in-scope fix — and would have shipped a fourth workaround
in the very run whose purpose was deleting the first three.

Related, smaller: the executor burned an internal attempt on what was never a defect in its own
files. Once it could write that blocker sentence, it had everything needed to stop. There is no
affordance for "this is a contract/semantics question about a shared seam, not a bug in my
task" — `task-blocked` exists but reads as *architectural resistance*, not *the defect is one
layer down*.

Also worth recording because it misled me mid-run: the executor's internal fix attempt and the
orchestrator's `task-retry` count are two different budgets, and it is easy to conflate them. A
task that comes back `failed` having tried twice internally has still spent **zero** orchestrator
retries. I briefly reasoned as though I was at the cap when I had both retries available.

## Expected

The retry path should force an altitude check before re-aiming — something like: *before
amending the failing task, ask whether the defect actually lives in a shared primitive, seam, or
contract that this task merely consumes. If it does, the amendment targets that, and every other
consumer inherits the fix.* A hint that the map's "duplicated copies" and "sync hazards" fields
are the evidence for this question would make it mechanical rather than dependent on the
orchestrator happening to remember them.

Executors should have a way to return "the failure is in a shared contract I don't own, here is
the diagnosis" without spending a second attempt inside their own files.
