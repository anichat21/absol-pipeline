# Scratchpad built a systemic feature that was never shaped enough to build

- date: 2026-07-17 · project: husk · run: RUN-2026-07-17-3
- component: scratchpad / shaper gate (conduct)

## What happened

INBOX-038 (dynamic platform) had a shape block, so the scratchpad session treated it as
buildable and built SCR.1–4 in one sitting. But the feature rewires the create flow's
foundations, and the shape never answered the systemic questions: how the platform path
absorbs the package-params (wheelbase) step — owner expects ONE question ("which segment?"),
not params-then-buck; and how the old AI create flow actually gets deprecated (billboard
trigger, gate, cluster). The assistant silently assumed answers to those (kept the two-step
flow, bolted a mode dropdown onto the old card) while spending its questions elsewhere.
Prod smoke failed: picking the hatchback still ran the entire old AI pipeline (filed as
husk BUG-006), and the owner's verdict was "this idea was never shaped properly enough to
begin with — these are things you should have surfaced."

## Expected

A shape that rewires an existing system is not buildable until the collision with that
system is decided. When a build touches the seams of an existing flow, the missing systemic
decisions (what replaces the old step? how does the old path die?) are shaping questions to
put to the owner BEFORE code — same doctrine as 003 (surface surprises), applied to design:
assumed answers to system-level questions are exactly the ones that must be surfaced.
Scratchpad should have escalated to the shaper instead of building.

Owner addendum (same day): the root behaviour was greed to solve — the assistant wanted
the buck-on-screen win in one sitting and kept momentum through four slices instead of
stopping at the first unanswered system question. Build-eagerness is a failure mode the
doctrine should name: momentum is not progress when the direction is unshaped.
