# Codex carried a full pipeline day — recon, planning, execution, review — and it held

- date: 2026-07-30 · project: arctic-tern · run: RUN-2026-07-30
- component: orchestrator / model routing

## What happened

Owner directive: burn the OpenAI pool (100%→82% yesterday, reset tonight), Claude keeps only
judgment and gates. Codex (gpt-5.6-sol) did, in one session: 8-lane parallel read-only recon
(root-caused 4 bugs incl. a two-part CSS specificity+media-gate hover bug; produced blast-radius
maps that flagged a genuine shape ambiguity — links.md has no env field — before planning),
6 parallel plans in strict task-schema format (all transcribed near-verbatim, zero rework),
all 7 full-tier executions (tests grew 55→70, green at every step), and the adversarial
item-scope seam review — which caught 4 real fix-required defects the per-task passes missed
(encoded-dot hub bypass, double perimeter + clipped focus ring, watermark scope, touch
targets). The fix batch also went to codex; re-verified green. Claude wrote every ledger
block, adjudicated the review, ran the browser smokes, and did git.

Friction worth encoding:
- Parallel read-only lanes via background ask.sh worked flawlessly; writers stayed serial.
- One stale smoke server nearly got a correct fix misdiagnosed as failed — verify against a
  freshly restarted process before blaming the diff.
- Planner-in-schema (prompting codex to emit the exact [task] block format) made
  plan-transcription mechanical; recommend making that the standard codex-planner contract.
- Effort split held: plans at high, execution at medium, review at high.

## Expected

This is the case for promoting codex from "volume lane by default" to a first-class pipeline
role: planner and reviewer contracts in the skill itself, with Claude as conductor
(shape/gate/adjudicate/git only). Quota reality: a full 9-task run + recon + review fit
comfortably inside one day's Plus window.

Usage figure (owner-reported, end of session): 82% → 62% of the Plus window for the entire
day — recon fleet, 6 plans, 7 executions, 2 whole-diff reviews, fix batch. ~20 points buys a
full pipeline day; yesterday's comparable session cost ~18. Consistent and affordable.
