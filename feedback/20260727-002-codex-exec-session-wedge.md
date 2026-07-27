# codex exec wedged 80 min polling a dead internal shell session — no detection, no timeout

- date: 2026-07-27 · project: huntrx · run: RUN-2026-07-27-3
- component: absol-codex (exec reliability / monitoring guidance)

## What happened
BUG-034.1 execution run (gpt-5.6-sol, medium): codex finished all its edits (~09:34Z, 6
patches, tests it wrote later verified 18/18 + full suite 500 green) then wedged for 80+
minutes — pid alive, zero rollout writes, no child process, one in-flight internal call
`{"session_id":72820,"chars":"","yield_time_ms":30000,...}` polling an exec session with no
process behind it. Orchestrator detected it only by noticing rollout mtime staleness, killed
the pid, and salvaged the (complete) work from the tree.

## Expected
The skill should name this failure mode and the check: rollout file mtime stale ≥ N min +
no child process under the codex pid = wedged, kill and salvage; the tree, not the wrapper
output, is the source of truth for completed work. (Upstream, a codex-side liveness timeout
on session polls would fix it properly.)
