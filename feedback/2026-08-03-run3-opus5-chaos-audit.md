# RUN-2026-08-02-3 (Opus 5, 13h27m, 3.24M tok) — five mechanical failure modes, one orchestrator

- date: 2026-08-03 · project: huntrx · run: RUN-2026-08-02-3
- component: orchestrate, absol-research, seam review, retry loop

## What happened

Transcript: `~/.claude/projects/-mnt-nas-dev/aee15c48-39e7-41a8-ad1e-33da8e229021.jsonl`
(main orchestrator session, cwd `/mnt/nas/dev/projects/huntrx`, 1247 lines, 22:35Z Aug 2 →
16:29Z Aug 3). Later runs on Opus 4.8 did not reproduce any of this, so treat it as one
model's session, not the doctrine's steady state.

**1. The research map was trusted as fact three times, all caught only by the executor
refusing to proceed.** All three landed inside the first 90 min of execution (06:36–07:43Z):
`INBOX-082.2` (L524) — the orchestrator's own grep gate scanned `src/lib/components`, which
includes shadcn-owned `ui/sonner` the same task forbids touching; `INBOX-080.2` (L633) — map
asserted `AlertDialog.Description` renders a `<p>`, bits-ui actually renders a `<div>`
(`dialog-description.svelte:31`); `INBOX-080.3a` (L673) — map counted `session_sweep` at 12
params, it declares 13. In each case the executor blocked honestly instead of forcing the
false premise through, and the retry amendment struck the bad fact — but a map is a durable
artifact a *future* run reads as truth, and three wrong facts shipped into it in one planning
pass.

**2. The codex execution wrapper silently "wedged" at least nine times** (086.2 L751, E.2 L774,
E.6 L792/796, E.7 L819, E.9 L876, E.11 L911, E.12 L945, E.13 L964, E.16 L980) — the background
wrapper returned empty output while the underlying codex process had actually completed the
work. Every occurrence forced the orchestrator to stop, manually inspect the tree/test count to
confirm work landed despite the empty return, then continue. This is pure overhead repeated
across ~5 hours of the execution window (08:00–13:00Z) — no defect was ever caused by it, but
it consumed a large share of the orchestrator's own attention and tokens for zero signal.

**3. Two stray task-notifications arrived from agents this session never launched** — "Audit
batch C test files" (L1165) and "Test honesty audit" (L1178, repeated L1199-adjacent). Both
were correctly excluded from the run record ("I'm not folding claims from agents I didn't
commission"), but the pattern recurred and the second one's content was plausible enough that
attribution, not correctness, was the only thing keeping it out.

**4. The seam-review second lane hung and was never resolved, not just slow.** Doctrine's
default for this stage is a second independent (codex) reader over the whole diff; it ran
~50 minutes with no returning message and was killed at close (`kill 756680`, L1211 area) —
the orchestrator confirmed it wasn't wedged (fresh rollout file, live child) and chose to end
the session rather than wait further. Only one reviewer's findings (8 confirmed + 11 suspected
cross-task defects, filed as `INBOX-105`) made it into the record. The two-reader union the
audit-grade pass prescribes was never obtained — the run is explicitly single-lens at its most
important checkpoint.

**5. The orchestrator's own running tally drifted by the end of the session.** Its self-report
before finalizing (L1148, L1173) said 21 human-oracle tasks and 8 retries; the finalizer — a
fresh agent reading raw `run.md` events, not the orchestrator's memory — corrected both to 26
and 6 (L1239). Over 13h27m and 3.24M tokens the orchestrator's in-context bookkeeping had
degraded even though the ground truth was sitting in an append-only log the whole time.

Also notable but not a defect: the AFK gate opened at 23:53:21Z and then sat completely idle
(no assistant/user turns) until the owner typed "run the execution" at 06:18:25Z — the 6.5h gap
was the owner asleep, not the orchestrator planning; real execution wall-clock was 06:19→13:20Z
(7h00m).

## Weaknesses exposed

- **Research maps have no fact-check step before they're treated as ground truth for planning
  and grep-gates.** All three catches here were luck (an honest executor), not a mechanism.
- **No context/attention budget on long orchestrator sessions.** The tally drift (finding 5)
  and the reflexive "wedge" triage (finding 2) both look like a single very-long session
  slowly losing cheap bookkeeping capacity that a fresh reader (the finalizer) still had.
- **No timeout/escalation policy on the seam-review second lane.** "~50 minutes, then kill
  silently at close" is not a decision, it's what happens by default when nothing is defined.
- **No provenance check on task-notifications** — this run improvised the right call twice by
  judgement; the doctrine should make "if I didn't launch it, it doesn't count" explicit rather
  than relying on the orchestrator to reason it out live.
