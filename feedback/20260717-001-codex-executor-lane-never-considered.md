# Bulk executor fleets never consider the codex lane — and would be ideal executor-race material

- date: 2026-07-17 · project: husk · run: RUN-2026-07-17-2 (scratchpad)
- component: front door / orchestrator routing (model doctrine application)

## What happened

Post-v0.0.6 device-test scratchpad dispatched three parallel UI fix clusters (Button-primitive
conversions, CSS stack layout, shader falloff tweak, stroke-undo stack) — well-specified,
map-fed, each with a tight vitest oracle. Two of three clusters are squarely model-doctrine's
codex "bulk" lane ($0 marginal), and the session was late-game on the Claude window after a
13-task pipeline run — exactly the late-game protocol's shift condition. The orchestrator
never considered codex: the skill only triggers on explicit user mention, so the doctrine's
routing advice can't fire from inside a session. The owner spotted the miss, not the tooling.

## Expected

When spawning bulk-executor work late-session, the codex lane should at least be weighed
(a one-line proposal to the owner would do). Separately: clusters like this — small, disjoint,
test-oracled — are the ideal benchmark for model-doctrine's open test #1 (executor race);
worth queueing one as race material instead of running it single-lane.

## Owner's framing

"Out of curiosity, these fixes would be a good candidate to run with chatgpt agent no?" —
observation offered mid-session, curiosity-grade, not a directive to reroute the running work.
