# The absol–ArcticTern merge — spec

- date: 2026-08-02 · project: absol + arctic-tern · run: n/a
- component: whole system
- status: decided, not started. This is the spec for the work; decisions only.

## Target structure

One repo at `projects/absol/`, three subfolders split by audience:

```
projects/absol/
  portfolio.md         ← estate index, stays at root, above all three
  skills/  (+agents/)  ← what agents read: conduct, triggers. Never absol-managed.
  cli/                 ← what code runs: absol-tool, parse.mjs, schemas.md, code rules. Never absol-managed.
  arctic-tern/         ← what the human sees: view layer, discovery only.
    .absol/            ← arctic-tern's ledger moves in whole, nested here
```

- **Migration method: manual rebuild.** Create the new skeleton, move everything into it
  deliberately, piece by piece. Old locations are not bulk-moved; whatever is left sitting
  in them at the end is either crap to delete or a forgotten decision to make. The audit is
  the method.
- ArcticTern stays a pure view layer. Its only write-back is annotations, which sweep
  drains. It imports `cli/lib/parse.mjs` relatively (kills the cross-repo absolute path);
  Docker builds from the repo root so `cli/` rides into the image.
- The annotation store grows into a typed command queue (decided 2026-08-04): dots carry a
  type (bug/debt/idea) and can target an existing item ID; later `blocked-by:` assertions.
  Frontend may add outbox/edit/withdraw UI over pending dots. Everything still lands in
  the sidecar and drains through sweep → note-taker — no direct ledger writes, ever.
- Shared doc assets (`/docs/_assets/`) move out of the retired absol-docs skill path into
  `arctic-tern/`; server.mjs drops the legacy pin.

## Ledger scoping and dogfood guardrails

- `.absol/` lives only inside `arctic-tern/`. `/absol arctic-tern` opens that folder; runs
  work relative to it.
- Runs opened from `arctic-tern/.absol` touch `cli/` only when the plan explicitly says so,
  and never touch `skills/`. Skill edits are owner-and-conversation work, never run work.

## Portfolio

- Stays at the merged repo root (current `DEFAULT_PORTFOLIO` path is already there).
- Schema gains a `path:` field per entry (`PORTFOLIO_FIELDS` + parse). The front door
  resolves projects through the portfolio path instead of assuming `projects/<slug>/` —
  this is what makes the nested `arctic-tern/` reachable, and future nesting free.

## Schemas

- `schemas.md` moves from `skills/absol/references/` into `cli/`, co-located with
  `parse.mjs`. One truth home: the law next to its implementation. Skills point at it,
  never restate (existing rule, new address).

## Worktrees — dev/prod split for skill refinement

- Two worktrees on one `.git`: `projects/absol/` (main, prod) and `projects/absol-dev/`
  (dev). Same pattern as snowowl/zei.
- `~/.claude/` symlinks and Docker builds point at **main only**. All refinement happens in
  `-dev`; a skill edit is no longer live on save. Promotion = merge dev → main; the merge
  is the release moment.
- ArcticTern's existing dev-shadow (`<slug>-dev` shadows base) already keeps the dashboard
  clean.

## Schema additions (wayfinder adoptions)

- **`blocked-by:`** — optional scalar, comma-separated item IDs, cross-ledger legal. Lint
  errors on dangling references. `query`/`status` derive the unblocked frontier; run
  selection skips blocked items. ArcticTern renders the dependency graph on the tracker
  board.
- **`type: FOG`** — a suspected-but-unstatable question. Exempt from shaping and all run
  gates, never runnable, lint forbids it carrying a plan block. Graduates by being retyped
  once the question can be stated precisely.

## CLI-first refactor

The CLI owns everything falsifiable; skills keep judgment and triggering.

New/absorbed verbs:

- `status` — banner derivation and the run.md liveness/recovery matrix (counts, open/smell
  lines, primed/shaped/new, frontier). The front door runs this instead of cat-ing ledgers.
- `init` — the newproject scaffold.
- `migrate --check | --apply` — schema versioning + deterministic migration; git is the
  revert path.
- `sweep` — the mechanical drain (fetch dots, verify, delete). Classification stays with
  note-taker.
- `archive` — the finalizer's mechanical half (event walk, effort stamps). Prose folding
  stays LLM.
- `run open | close` — run.md lifecycle bookkeeping.
- `gate` — which items lack shape/map/plan for a proposed run set.

Roster consequences:

- `absol-newproject` and `absol-migrate` collapse to trigger stubs over their verbs.
- `absol-sweep` and the front door split: mechanics to CLI, conduct stays.
- Every enforceable rule moves from doctrine prose into either a refusal (`die()`) or
  just-in-time output (verb output/errors carry the next instruction).
- The CLI **quotes** doctrine by reference (anchored sections in doctrine.md); rule text is
  never forked into JS strings.
- Deterministic core gets `node --test` coverage; skill refinement can no longer silently
  break mechanics.

## Git adoptions (decided 2026-08-04)

- Executor commits carry an `Absol-Task: <item.task>` trailer — `git log --grep` becomes a
  query surface; ArcticTern can render item → commits later.
- `archive`/the finalizer derives tallies and effort stamps from run.md + git (diffstat
  per task), never from orchestrator memory — kills long-session tally drift.

## Three controlled surfaces, all living as siblings

1. **State** — `cli/schemas.md` + parser + lint (exists).
2. **Prose (STE-derived)** — approved-terms table in `meta/authoring.md`: one meaning per
   term, no synonym drift, active voice, one rule per sentence. Doctrine/schemas rewritten
   against it once. Mechanical rules enforced by `lint --prose`.
3. **Code (Power-of-Ten-derived, four rules, not ten)** — short code-rules section in
   `cli/`: assert at boundaries and fail loudly; fixed bounds on all loops; simple control
   flow, screen-sized functions; tests + lint are gates and the zero-dependency budget is
   absolute. No 60-line ceilings, no assertion quotas, no always-on review skill.

## Sequence

1. Skeleton + manual rebuild (the move-and-audit).
2. Portfolio `path:` field + front-door resolution through it.
3. CLI mechanical verbs — `status` first (biggest per-session win), then the rest.
4. Skill roster pass (stubs, splits, rules → refusals/JIT).
5. `blocked-by:` + `FOG` in schema, lint, query.
6. ArcticTern frontier/dependency render.
7. Prose pass (terms table, doctrine/schemas rewrite, `lint --prose`).
8. Code-rules section in `cli/`.
9. Worktree split (once refinement play resumes).

## Open decisions

- Push policy for the merged repo: absol is commit-only-never-push, arctic-tern pushes to
  GitHub. One repo needs one policy.
- Git history: manual rebuild starts clean; whether to graft old histories (subtree) or
  archive the old repos as-is.
- Existing feedback notes fold in downstream: architect+megareview merge and travel mode
  both get simpler after phase 4 (one review skill with an internal mode; travel mode
  mostly becomes "prefer CLI paths and AFK defaults").
