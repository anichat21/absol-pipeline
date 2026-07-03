# megareview sizes the fleet to the skill template, not the repo — user killed a 20-agent run on a 9k-line project

- date: 2026-07-02 · project: shearwater · run: wf_86b76d1f-9f2 (megareview workflow, killed mid-run)
- component: megareview

## What happened

A megareview of shearwater (~9.3k lines of src, 37 files) was dispatched at the skill's
template shape: 5 finder dimensions + up to 13 refuters + structural judge + synthesis
(≤20 agents), all on fable per the user's ask. The user killed it mid-Find phase for token
burn: "you overplanned its a baby project it didny need this mych token usage." Salvage
recovered 27 findings from the 3 finders that completed; the bugs + docs-drift finders and
the entire verify/synthesis stages never ran, so the report shipped partial and unverified.
The skill caps the fleet ("finders + refuters ≤ ~20") but only scales *upward* ("split big
repos by subsystem") — there is no downward guidance, so a small repo gets the same 5-finder
+ per-finding-refuter shape as a large one.

Follow-up (same session): the user's sharper point is that the **adversarial stages
themselves** are the overbuild, not just the finder count — "you gonna adversarial an
if-else? That too with expensive fable?" The per-finding refuter fleet, judge, and separate
synthesis agent are research-grade shapes applied to a baby project, compounded by an
expensive-model override on every agent.

## Expected

User's rule of thumb: **under ~20–30k LOC, no research-grade shapes at all** — no per-finding
adversarial refuters, no judge panel, no separate synthesis agent. A regular workflow (a few
finders, or one pass; orchestrator composes the report from structured output) is the whole
review. Reserve refuter fleets and expensive-model overrides for genuinely large codebases.
