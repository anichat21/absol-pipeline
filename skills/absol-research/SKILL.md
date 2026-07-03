---
name: absol-research
description: Read-only codebase mapping for ledger items about to be planned. Fans out parallel readers over each item's blast radius (entry points, consumers, sync hazards) and writes a dated map block onto the item. Use on '/absol-research <items>', 'map the blast radius', or when the run gate hits an unmapped item.
---

# absol-research

You produce the map; the planner builds from it. One planner context can't cover a consumer
graph — it under-predicts `files_touched` and misses the duplicated copy that lags. More eyes
fix a coverage problem; a smarter planner doesn't. Output: a `map:` block per item (schema:
`~/.claude/skills/absol/references/schemas.md`). You design nothing, decide nothing, edit no
source.

## Read first

`.absol/CONTEXT.md` (the map must use its vocabulary), `.absol/adr/` (flag collisions, don't
re-litigate), each item (its `shape:` bounds what to map — the in-scope surface, not the whole
module).

## Scale to the work

- **Trivial item** (one file, no shared interface — a typo, a CSS value): read the file
  inline, write a two-line map, done. No fleet.
- **Fresh map already present** (dated today): reuse it.
- **Non-trivial or cross-cutting**: dispatch the workflow below.

## The fan-out (Workflow tool — this skill is your opt-in)

Two stages per item: stage 1 finds *what changes*, stage 2 greps *what that ripples to* — the
ripple is exactly what a single context misses. Readers are read-only (no Edit/Write, no
worktrees). **Embed the items as a literal `const` in the script** — the Workflow `args`
field does not reach the script in this environment (see workspace CLAUDE.md). Give every
reader the read-hygiene rule: check file size first; over 256 KB, sample with
`head`/`grep`/`jq`, never read whole.

```js
export const meta = { name: 'absol-research', description: 'Map blast radius', phases: [{title:'Map'},{title:'Trace'}] }
const ITEMS = [/* {id, title, description, subsystem, shape?} — literal, not args */]
const PROJECT = '/abs/path'
const maps = await pipeline(ITEMS,
  s => agent(`Read-only; never read files >256KB whole (sample instead). Project ${PROJECT};
      use .absol/CONTEXT.md vocabulary. For ${s.id} (${s.title}: ${s.description}) name the
      entry points and every type/export/schema the change modifies. Files+symbols, no line
      numbers.`, {label:`map:${s.id}`, phase:'Map', schema: MAP}),
  (m, s) => agent(`Read-only; same file-size rule. Project ${PROJECT}. Grep consumers of:
      ${m.changing_symbols.join(', ')}. Every call site that must change in lockstep, plus
      DUPLICATED copies that silently lag. Full blast radius.`,
      {label:`trace:${s.id}`, phase:'Trace', schema: TRACE}).then(t => ({s, ...m, ...t})))
return maps.filter(Boolean)
```

No Workflow tool in session → a few `Explore` agents (one per item, same two questions).

## Output

Fold each result into the item's `map:` block (dated) in its intake file — entry points,
changes, blast radius, consumers, sync hazards, patterns to mirror, gotchas, ADR check. New
information only; omit empty fields; when a file *might* be touched, list it and say why —
under-mapping is the failure you exist to prevent.

**Keep the map block condensed — the ledger is read on every banner and plan.** When the raw
fan-out output is big (roughly: it wouldn't fit on two screens), write it to
`.absol/reviews/{YYYY-MM-DD}-{ITEM-ID}-map.md` and end the map block with
`Full detail: reviews/<that file>`. The block carries the synthesis; the artifact carries the
per-facet detail. Nothing is lost, and inbox.md doesn't bloat.

Report in ≤3 lines (items mapped, blast-radius sizes, hazards). Your sole writes are `map:`
blocks and their overflow artifacts in `.absol/reviews/`; noticing a real architectural
problem earns one line — "consider `/absol-architect`" — not action.
