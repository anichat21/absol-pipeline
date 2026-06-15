# Verification-oracle fixes — shipped 2026-06-15

The "green tests, broken feature" pattern was the highest-cost recurring failure across
all 6 projects (e.g. snowowl-dev RUN-2026-05-30-2: 12 tasks, 522 tests green, fully
reverted — wipe registry keyed by productId but queried by manifest id, lookup always 0).
Root cause: for seam/visual work the unit suite is not the *oracle* (the thing that judges
correctness); the real oracle (a runtime probe, or a human) ran after finalize or never.

All four shipped:

1. **`verify_oracle: unit | integration | human` on every task.** Planner sets it
   (`absol-planner.md` "Picking `verify_oracle`"); schema in `schemas.md`.
2. **`integration` ⇒ a real runtime probe.** Executor exercises the seam and asserts the
   real result; never a string-inspection, never `pass` on an unexercised path
   (`absol-executor.md` Verify). Probe = a general runtime check / the project's own e2e
   harness — the interactive Playwright `/verify` skill is deliberately NOT wired into the
   unattended pipeline (fragile coupling).
3. **`human` ⇒ a blocking, visible state.** Finalizer records owed tasks in state.md
   `## Owes Human Smoke`; `/absol` surfaces them at the top of the banner; cleared when the
   user confirms (or routed to `note-taker` as a BUG if smoke fails). A built-but-human-
   unverified task is `done` but never *silently* done.
4. **`fix-required` re-executes in-run.** A fix-required review verdict re-enters the
   test-fail loop (plan amend → re-execute → re-review), capped at 2 shared with the
   verification retries, instead of finalizing as done-with-a-follow-up
   (`absol-orchestrate.md` Step 5).

Scratchpad intentionally untouched — the human is present, so smoke happens live.
Architect untouched — it self-allocates and runs solo.
