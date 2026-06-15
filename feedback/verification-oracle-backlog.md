# Verification-oracle fixes — pinned 2026-06-15

The "green tests, broken feature" pattern is the highest-cost recurring failure across
all 6 projects (e.g. snowowl-dev RUN-2026-05-30-2: 12 tasks, 522 tests green, fully
reverted — wipe registry keyed by productId but queried by manifest id, lookup always 0).
Root cause: for seam/visual work the unit suite is not the *oracle* (the thing that judges
correctness); the real oracle (a runtime probe, or a human) runs after finalize or never.

User approved all four (2026-06-15). Parked — not yet built.

1. **Tag each task's oracle.** Planner emits `verify_oracle: unit | integration | human`.
   Forces an honest admission of when the suite can't judge the work.
2. **`integration` ⇒ a real runtime probe**, not string-inspection of generated output.
   Exercise the actual seam (mount the registry, call the query, assert >0; hit the
   endpoint, assert the shape the UI consumes). This one alone prevents the 12-task revert.
3. **`human` ⇒ a blocking, visible state.** Run finalizes as `needs-human-smoke`; the next
   `/absol` opens with "you owe smoke on TSK-NNN" up top — not a footnote that silently
   becomes "done."
4. **`fix-required` re-executes** in the same run (re-plan → re-execute, capped) instead of
   finalizing as done-with-a-follow-up.

Priority: #1+#2 first (cheapest, highest ROI). #3 is the honesty fix for the
un-automatable tail (3D/audio feel, real devices). #4 is cleanup.

Open question carried over: for web projects, wire `/verify` (Playwright) as the
integration probe, or keep probes as plain headless scripts the executor writes?
