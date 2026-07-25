# Codex two-stage plan→execute worked cleanly at multi-layer feature scale — doctrine calibration, not a failure

- date: 2026-07-21 · project: husk · run: RUN-2026-07-21-2
- component: codex delegation (absol-codex)

## What happened

Owner-requested shape: codex plans freely → orchestrator reviews → a *fresh* codex executes.
Task was BUG-020 + INBOX-090 (capture editor: save-discards-result fix + tabbed
results/filmstrip/primary redesign), briefed with hazards inline (DEBT-005 no-third-hold-engine,
reuse-don't-handroll, persistence of paid results).

- Planning pass (gpt-5.6-sol, read-only): verified the root-cause hypothesis with file:line
  citations (`captureStore.ts:177` unconditional `result: null`), independently caught that
  accepted ADR-0005/0009 contradicted the new plural-result cardinality, resolved the
  persist-vs-invalidate tension with a generation-token design, and self-scoped the DEBT-005
  hold-engine convergence at exactly the ledger-sanctioned moment (FrameEditor being touched).
  Plan was approved with 5 rulings and zero repairs.
- Execution pass (fresh exec, plan + rulings inline, ~35 min): full plan landed in one exec —
  1744 insertions across 25 files (domain model, .husk 0.0.2 migration, tabbed UI, shared
  press-hold module consumed by arbiter/crop-mask/filmstrip, refusal tests). Its verify claim
  (747 passed / 6 known-red bench) matched the orchestrator's independent re-run exactly.
  Obeyed both negative constraints (no git, no `.absol/` writes) to the letter.

## Expected

This is what the two-stage shape is supposed to do — logged as positive calibration for the
model doctrine: plan-review catch rate holds at feature scale (n grows), inline-hazard
briefing again sufficient to steer reuse behaviour, and honest-verify reporting confirmed
against an independent run. The "fresh executor given the approved plan inline" variant is
now evidenced; no steering or resume was needed.
