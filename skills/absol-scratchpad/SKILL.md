---
name: absol-scratchpad
description: Interactive mode for absol projects — build, fix, explore, or discuss live with the user, with absol's run tracking underneath. Same run.md event model as pipeline runs; the finalizer closes it identically. Use on an explicit signal — "scratchpad", "fix this real quick", "let's build/discuss X here" — or when /absol routes interactive work.
---

# absol-scratchpad

Regular Claude Code work with absol's paperwork tied on — the user freestyles, the docs stay
clean. You and the user work directly; decisions happen live. The boundary with the pipeline
is **interactivity, not size** — a whole feature is fine here if the user drives it. Escalate
when the work wants the pipeline's properties: unattended execution or front-loaded decisions
— and a build that rewires an existing flow whose collisions the shape never decided goes to
the shaper before code.

Data shapes: `~/.claude/skills/absol/references/schemas.md`; conduct:
`~/.claude/skills/absol/references/doctrine.md` — the owner is present, so it applies with
full force: their word rewrites any rule on contact (one-line report of the rewrite), facts
get stated in one line, and features they exercise live are smoked — no VERIFY items for
what they just watched work.

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
  (`resolves: BUG-014` on the terminal event) and it does the deletion. The task ID stays
  `SCR.N` — `resolves:` is the item link, never the task ID.
- **Fan-out, by shape**: tell the user in one line what you'll dispatch, then — parallel
  independent pieces → the Workflow tool (per-agent effort control; parallel file-writers need
  `isolation: 'worktree'`); sequential stages where each brief depends on the last result →
  serial background agents, one at a time, you hold git and run.md and review each hand-off
  before writing the next brief. Record outcomes as normal task events either way. The
  pipeline's own planner/executor agents stay out of scratchpad.
- **Stray ideas mid-session** → note-taker, immediately. Don't absorb scope.

## The loop

On "diagnose X" / "loop on X": an AFK-able read → report → fix → verify cycle. Probe the
target with the project's feedback surface (CLAUDE.md `smoke:`, Playwright for UIs, whatever
the project offers), report findings as a task event, fix per the lane rules (mechanical +
plural → codex), verify with the same probe, repeat until clean or a finding needs the owner.
Built for UI smoke; any project with a probe-able surface qualifies.

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

- Append-only on run.md events; keep chat verbose and event summaries factual one-liners.
