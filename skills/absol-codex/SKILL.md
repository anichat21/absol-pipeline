---
name: absol-codex
description: Delegate work to OpenAI Codex CLI (GPT, $0 marginal on the ChatGPT sub — a separate usage pool from Claude). Fires on explicit "codex" mention anywhere ("ask codex", "codex review", "/absol-codex") — and by default inside absol runs, where the orchestrator routes volume work (execution batches, whole-diff review, bulk reading) here with a one-line report. Outside runs, never self-trigger on generic phrasing ("second opinion", "have GPT check this") that doesn't name codex.
---

# absol-codex

Shells out to `codex exec` (non-interactive). Auth is the ChatGPT $20 subscription — no API
billing possible, quota is Plus-tier rolling windows, and it does **not** drain the Claude
usage window. Evidence for *when* GPT is the right pick lives in the absol model doctrine
(`/mnt/nas/dev/projects/absol/meta/model-doctrine.md`); this skill owns the *how*.

Codex runs `gpt-5.6-sol` — a frontier-class near-peer, treated as a competent agent, not a
caged junior. It works directly in the real checkout; safety is git's commit gate, not
containment choreography. (Worktree + symlink + merge ceremony destroyed irreplaceable data
once, orchestrator-side: `meta/incident-2026-07-20-husk-data-loss.md`.)

## The system — three rules

1. **Codex reads the project docs itself.** Each project carries a committed one-line
   `AGENTS.md` (codex auto-ingests it): *"Read `CLAUDE.md` before working — it is binding
   for you too. Do not run git commands; leave the working tree for the orchestrator to
   review and commit."* Create it on first codex use in a project.
2. **Write runs sit on the commit gate.** Tree committed (or clean) before codex touches
   it — absol's pre-run commit covers pipeline runs; check `git status` when invoking ad
   hoc. Afterwards: `git diff`, sanity-read, commit. Rollback is `git reset --hard`.
3. **Codex edits, absol gits.** The AGENTS.md line forbids codex git; orchestrator git is
   nothing but `status` / `diff` / `commit`.

Read-only asks (opinions, reviews, planning) need none of this — just prompt it. For a
read-source/write-elsewhere shape, set cwd to a scratch dir and state "the repo is
READ-ONLY, I will diff it" — held byte-identical at 4K-line scale (artemis, 2026-07-20).

The gate covers *tracked* files only; the workspace hoard convention (dev workspace
`CLAUDE.md`) guarantees that's everything valuable — gitignore hides regenerable junk only.

## What to send it, and how to brief it

Codex is the volume lane — execution batches, review passes, bulk reading; judgment and
gates (shaping, plan approval, commits) stay with Claude. Quota is generous: treat it as
free parallel power, not a scarce fallback. Calibration evidence lives in the model doctrine.

- **Brief it like a respected peer**: goal, acceptance criteria, constraints/refuse-lines —
  never a step-by-step how. The validated runs won *because* codex planned its own path
  (caught ADR contradictions, self-scoped work the brief didn't ask for).
- **Brief hazards inline.** Codex under-weights artifacts the brief only references — a
  hazard flagged in a linked map file was acted on only once restated in the brief body
  (husk RUN-2026-07-17-4). Binding constraints, refuse-lines, and vocabulary go in the
  prompt text; file references are background only.
- **Effort split (validated)**: plan at `high`, execute at `medium` — a well-briefed
  executor doesn't need high.
- **Reading is sanctioned** (owner call, 2026-07-25; tier calibration via the docs-hub race).
  Read-only calls carry no commit gate — parallelize freely as background `ask.sh` calls.
  Writers stay serial on the one checkout.
- **Second opinions / plan review** — free adversary before the execute gate.
- **Bulk ports: go two-phase** — framework/contract first, volume second, with "tell me if
  the contract breaks" standing; the phase-1 diff is what makes the architecture claim
  verifiable (LVGL→HTML port, 2026-07-20: 1,198 lines added phase 2, 4 changed).

## Invocation

Preferred — the wrapper (bakes the traps, prints only the final message):

```bash
~/.claude/skills/absol-codex/scripts/ask.sh [-m MODEL] [-e EFFORT] [-C DIR] [-s SCHEMA.json] [-t SECS] "prompt"
```

Defaults: `gpt-5.6-sol`, effort `high`, cwd, 900s timeout. For project work pass
`-C <project root>` so `AGENTS.md` is picked up. Output is the final agent message only —
progress/reasoning noise never reaches the caller's context. Non-zero exit prints the log
tail to stderr.

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

- Available on this plan: `gpt-5.6-sol` (flagship, quality pick), `gpt-5.6-terra` (lower-cost
  tier, verified 2026-07-25), `gpt-5.5` (config default; superseded — prefer the 5.6 tiers).
  Bare `gpt-5.6` / `gpt-5.6-codex` are rejected server-side.
- Multi-turn: `codex exec … resume --last` (or `resume <id>`) — every exec-level flag goes
  **before** `resume`, e.g.
  `codex exec --skip-git-repo-check --sandbox danger-full-access -m gpt-5.6-sol -C <dir> -o <out> resume --last "<prompt>"`;
  flags after `resume` error out. Chunk long work into checkpointed execs — there's no live
  steering. `--ephemeral` kills resumability.

## Traps

- Global flags (`-a/--ask-for-approval`, `--search`) go **before** `exec`, not after.
- A positional prompt makes piped stdin ignored; to feed stdin as the prompt use `codex exec -`.
- Outside a git repo, `--skip-git-repo-check` is required or codex refuses to run.
- Codex silently appends `trust_level` blocks for its cwd to `~/.codex/config.toml` — it
  writes outside its `-C` dir as a matter of course; don't treat `-C` as containment.
- No quota-query surface — on rate-limit errors, back off; GPT quota exhaustion is not a
  Claude problem, just report it.
