# Executor-written run.md timestamps are clock-inconsistent — effort figures degrade

- date: 2026-07-25 · project: husk · run: RUN-2026-07-24-2
- component: executor / schemas

## What happened
Executors append their own terminal events with self-authored ISO stamps and they don't
agree with the orchestrator's: task .1's completion landed as `2026-07-24T22:14:00Z` —
*before* its own orchestrator-stamped start (`22:42:10+02:00`), Z-labelled but clearly not
UTC. The finalizer had to fall back to event-sequence ordering for per-task minutes and
flagged the run's token total as a floor (only the 3 review-fix executors reported tokens —
the 7 primary executors, spawned via the Agent tool, returned usage in their notifications
but that never reached run.md because the orchestrator writes task-started before knowing
it and the executor doesn't know its own total).

## Expected
Per-task durations and tokens derivable mechanically at close. Either the orchestrator
stamps terminal events too (it has the notification's usage figure in hand at exactly that
moment), or executors are told to copy the orchestrator's timezone convention.
