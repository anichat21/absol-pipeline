# Ops/deploy knowledge stays in the run archive — durable docs never learn it

- date: 2026-07-11 · project: zei · run: RUN-2026-07-11-3 (surfaced at launch; the gap itself spans earlier runs)
- component: finalizer / scratchpad (capture), front door (answered from stale docs)

## What happened
The owner preapproved an AFK run with a prod push. The front door checked the workspace
CLAUDE.md network table (vm / jellyfin-vm / AWAC / RNLT-edge — no NAS row) and told the
owner a wrong caveat: "the NAS isn't in my SSH alias table, so the final compose bump may
land as a manual step." The owner pushed back; only then did a check of `~/.ssh/config`
and the zei archive show a working `nas` alias (claude@192.168.0.12:7065, set up by a
scratchpad task earlier this month) and a full push-to-prod procedure executed in at least
three releases (0.1.0, 0.5.0, 0.7.0) — recorded solely as finalizer "Ops:" lines in
`archive/2026-07.md` plus a stale one-off "Release 0.5.0" README section.

## Expected
When a run creates durable infrastructure/access (an SSH alias, a credential path) or
repeats an ops procedure, that knowledge should be folded into its durable home — the
workspace CLAUDE.md network table, the project README/runbook — by the run or its
finalizer, not left as archive history. The front door should never have to excavate the
archive (or be corrected by the owner) to learn a standing capability.
