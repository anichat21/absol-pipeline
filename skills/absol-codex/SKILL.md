---
name: absol-codex
description: Delegate work to OpenAI Codex CLI (GPT, $0 marginal on the ChatGPT sub — a separate usage pool from Claude). Fires on explicit "codex" mention anywhere ("ask codex", "codex review", "/absol-codex") — and by default inside absol runs, where the orchestrator routes volume work (execution batches, whole-diff review, bulk reading) here with a one-line report. Outside runs, never self-trigger on generic phrasing ("second opinion", "have GPT check this") that doesn't name codex.
---

# absol-codex

Interface layer only: how to invoke codex, keep it safe, and compile a brief for it. *When*
codex is the right pick — roles, tiers, calibration evidence — lives in the model doctrine
(`/mnt/nas/dev/projects/absol/meta/model-doctrine.md`); role definitions (planner gates,
executor rules, reviewer checks) bind whoever fills the seat and live in `agents/`.

Shells out to `codex exec` (non-interactive). Auth is the ChatGPT $20 subscription — no API
billing possible, quota is Plus-tier rolling windows, and it does **not** drain the Claude
usage window. The model is a frontier-class near-peer: treat it as a competent agent working
directly in the real checkout; safety is git's commit gate, not containment choreography
(evidence and the one counter-incident: model-doctrine).

## The safety contract — three rules

1. **Codex reads the project docs itself.** Each project carries a committed one-line
   `AGENTS.md` (codex auto-ingests it): *"Read `CLAUDE.md` before working — it is binding
   for you too. Do not run git commands; leave the working tree for the orchestrator to
   review and commit."* Create it on first codex use in a project.
2. **Write runs sit on the commit gate.** Tree committed (or clean) before codex touches
   it — absol's pre-run commit covers pipeline runs; check `git status` when invoking ad
   hoc. Afterwards: `git diff`, sanity-read, commit. Rollback is `git reset --hard`.
3. **Codex edits, absol gits.** The AGENTS.md line forbids codex git; orchestrator git is
   nothing but `status` / `diff` / `commit`.

Read-only asks (opinions, reviews, planning) need none of this — just prompt it, and
parallelize freely as background calls; **writers stay serial per checkout**. For a
read-source/write-elsewhere shape, set cwd to a scratch dir and state "the repo is
READ-ONLY, I will diff it". The gate covers *tracked* files only; write targets outside any
gate (non-repo paths, deliberately-ignored files) get a tar backup first — that's the
rollback there.

## Brief compilation — codex is one-shot

No follow-up questions, no live steering: the brief must be complete when it leaves. Compile
every brief against this checklist:

- **Goal, acceptance criteria, constraints — never a step-by-step how.** The role
  definition's gates (planner/executor/reviewer) travel in the brief when codex fills that
  seat; for planners, demand output in the exact `[task]` schema so transcription is
  mechanical.
- **Hazards, refuse-lines, and vocabulary go in the prompt body.** Codex under-weights
  artifacts the brief only references — a linked map file is background, not instruction.
- **Flag-don't-force, in every brief**: "if a listed item looks wrong after reading, flag it
  with a citation instead of forcing the edit." A refusal is a review event — adjudicate
  before overriding.
- **State environment reality.** Name what's already there — "Playwright Chromium is at
  `~/.cache/ms-playwright`, drive it"; ports, running servers, fixtures — or the worker
  probes, gives up, and hides the gap behind weaker assertions.
- **Boundary**: improvise freely inside the app's API surface; storage-layer writes on live
  data are a flagged blocker back to the orchestrator, never a workaround.
- **Effort**: plan/judge/review `high`, execute `medium` (pass `-e medium` — the wrapper
  defaults to `high`).

## Invocation

Preferred — the wrapper (bakes the traps, prints only the final message):

```bash
~/.claude/skills/absol-codex/scripts/ask.sh [-m MODEL] [-e EFFORT] [-C DIR] [-s SCHEMA.json] [-t SECS] [-b] "prompt"
```

Defaults: `gpt-5.6-sol`, effort `high`, cwd, 540s timeout. For project work pass
`-C <project root>` so `AGENTS.md` is picked up. The wrapper starts codex detached and
prints `pid/out/log` paths to stderr up front, so a killed wrapper never orphans a hidden
run — on timeout it leaves codex running and tells you where to collect. Output is the final
agent message only. **Anything execution-sized runs `-b` (background: print paths, exit) or
inside a `run_in_background` Bash call** — the harness caps foreground Bash at 600s; never
raise `-t` past it in the foreground.

Raw incantation, when the wrapper doesn't fit:

```bash
codex exec --skip-git-repo-check --sandbox danger-full-access \
  -m gpt-5.6-sol -c model_reasoning_effort=high \
  -C <dir> -o /tmp/last-msg.txt "<prompt>" </dev/null 2>/dev/null
```

- `</dev/null` mandatory — piped/open stdin hangs exec ("Reading additional input from stdin…").
- `--sandbox danger-full-access` mandatory **on aidev** — bwrap sandboxes fail on this VM
  (`bwrap: loopback: Failed RTM_NEWADDR`). The Claude harness sandbox is the outer containment.
- `-o <file>` writes just the final message; read that, discard stdout/stderr.
- Structured output: `--output-schema <file>` — schema must set `additionalProperties: false`
  and list **every** property in `required`.

## Models & sessions

- Available on this plan: `gpt-5.6-sol` (flagship), `gpt-5.6-terra` (lower-cost tier),
  `gpt-5.5` (config default; superseded — prefer the 5.6 tiers). Bare `gpt-5.6` /
  `gpt-5.6-codex` are rejected server-side. Which tier fits which role: model-doctrine.
- Multi-turn: `codex exec … resume --last` (or `resume <id>`) — every exec-level flag goes
  **before** `resume`; flags after it error out. Chunk long work into checkpointed execs —
  there's no live steering. `--ephemeral` kills resumability.

## Traps

- **Wedge detection**: rollout file (`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`) mtime
  stale ≥5 min AND no child process under the codex pid = wedged (it can poll a dead
  internal shell session forever). Kill the pid and salvage — **the tree, not the wrapper
  output, is the source of truth for completed work.**
- Global flags (`-a/--ask-for-approval`, `--search`) go **before** `exec`, not after.
- A positional prompt makes piped stdin ignored; to feed stdin as the prompt use `codex exec -`.
- Outside a git repo, `--skip-git-repo-check` is required or codex refuses to run.
- Codex silently appends `trust_level` blocks for its cwd to `~/.codex/config.toml` — it
  writes outside its `-C` dir as a matter of course; don't treat `-C` as containment.
- No quota-query surface — on rate-limit errors, back off; GPT quota exhaustion is not a
  Claude problem, just report it.
- Token accounting: per-run usage lives in the rollout files (`token_count` events; the last
  one carries totals — read cached vs uncached input apart, the cached bulk is nearly free).
  Match runs to lanes by start timestamp.
