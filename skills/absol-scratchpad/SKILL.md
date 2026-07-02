---
name: absol-scratchpad
description: Interactive mode for absol projects — build, fix, explore, or discuss live with the user, with absol's run tracking underneath. Same run.md event model as pipeline runs; the finalizer closes it identically. Use on an explicit signal — "scratchpad", "fix this real quick", "let's build/discuss X here" — or when /absol routes interactive work.
---

# absol-scratchpad

You and the user work directly; decisions happen live. The boundary with the pipeline is
**interactivity, not size** — a whole feature is fine here if the user drives it (dispatch a
dynamic workflow for heavy lifting; this skill is your opt-in). Escalate only when the work
wants the pipeline's properties: unattended execution or front-loaded decisions.

Data shapes: `~/.claude/skills/absol/references/schemas.md`.

## Open

Same recovery checks as `/absol` (if invoked directly): existing run.md → stop and point at
`/absol`. Otherwise create `.absol/run.md` with header `mode: scratchpad`, run_id
`RUN-{YYYY-MM-DD}` (`-N` on archive collision). Restate what you're about to do in one line so
the user can redirect before edits land.

## Work

Tasks are improvised, not planned. Before each piece of work, append a `task-started` event
carrying `task: SCR.1` (incrementing), `title:`, and a one-line `description:` inline — there
is no plan block to reference. Then execute under the executor's rules (TDD vs direct-edit
split, verify-honestly, read-hygiene — see `absol-executor`'s definition) and append the
terminal event.

- **Pulled item** ("fix BUG-014 real quick"): read it from its intake file; its shape/map are
  your brief. Don't touch the item — if the work completes, tell the finalizer it resolved
  (`resolves: BUG-014` on the terminal event) and it does the deletion.
- **Workflow path**: for a big interactive build, tell the user in one line what you'll
  dispatch, then use the Workflow tool. Parallel file-writers need `isolation: 'worktree'`.
  Record the outcome as normal task events (`summary: built via workflow, N agents`).
- **Stray ideas mid-session** → note-taker, immediately. Don't absorb scope.

## Escalate to pipeline

When the user should walk away or a cluster of consequential decisions wants shaping first,
say so. If they agree: capture learnings via note-taker (or shape transcription onto the
source item), close the session below, and point at `/absol` → run. The pulled item was never
mutated, so nothing needs demoting.

## Close

On "that's it" / "done" / topic change:

- Work happened → ensure every task has a terminal event, then spawn `absol-finalizer`
  (project path + run_id). It archives, resolves any `resolves:` items, updates state.md,
  deletes run.md. Relay its one-line report.
- Pure discussion, nothing changed → delete run.md; anything worth keeping is already an
  item (note-taker) or an ADR. No ceremony.
- A task failed/blocked and the user hasn't decided → don't close; ask.

## Rules

- Never spawn the pipeline's planner/executor agents here — the Workflow tool is your one
  fan-out (safe because the user is present).
- Append-only on run.md events; keep chat verbose and event summaries factual one-liners.
