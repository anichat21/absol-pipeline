# Adversarial review + fresh tests both missed a z-order regression only the post-deploy smoke caught

- date: 2026-07-25 · project: husk · run: RUN-2026-07-25
- component: reviewer / scratchpad

## What happened
The UI rework passed three implementation agents' targeted tests, a full verify, and a codex
adversarial review that explicitly checked z-order ("Layer ordering is otherwise correct…
Mobile windows paint above MenuView tiles"). The orchestrator's post-deploy Playwright smoke
then found the full-height narrow sheet's close button sitting inside the island's 44px hit
box (island z120 over cards z100) — tapping × opened the menu. The regression was created by
the run's own bounded-body fix (cards previously overflowed off-screen, so the collision was
unreachable) and compounded by the run's own 44px hit-target fix. jsdom tests can't see
elementFromPoint truthfully; the diff review reasoned about layers, not hit geometry.

## Expected
For UI-touching runs, a post-deploy interactive smoke (drive the changed flows, measure hit
targets/geometry at phone viewports) should be a standing close step, not orchestrator
initiative — reviews reason about code, and the class of bug two correct fixes create
together only shows up rendered.
