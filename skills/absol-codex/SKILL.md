---
name: absol-codex
description: Delegate work to OpenAI Codex CLI (GPT, $0 marginal on the ChatGPT sub — a separate usage pool from Claude). Trigger ONLY when the user explicitly says "codex" — "ask codex", "codex review", "offload this to codex", "/absol-codex". Never self-trigger on generic phrasing ("second opinion", "have GPT check this") that doesn't name codex.
---

# absol-codex

Shells out to `codex exec` (non-interactive). Auth is the ChatGPT $20 subscription — no API
billing possible, quota is Plus-tier rolling windows, and it does **not** drain the Claude
usage window. Evidence for *when* GPT is the right pick lives in the absol model doctrine
(`projects/absol/meta/model-doctrine.md`); this skill owns the *how*.

## What to send it

- **Second opinions / plan review** — proven catch rate (beat Opus on planning judgment, n=1).
  Read-only by prompt; never let it edit a real checkout.
- **Bulk drafting, boilerplate, dumb-shit volume work** — anything where 2–4× slower
  wall-clock doesn't matter and free tokens do.
- **Late-game offload** — Claude 5h window hot → judgment stays on Claude, reading/drafting
  moves here.
- Its reading *precision* is unmeasured — don't hand it Opus's scout role yet (open test).

## Invocation

Preferred — the wrapper (bakes the traps, prints only the final message):

```bash
~/.claude/skills/absol-codex/scripts/ask.sh [-m MODEL] [-e EFFORT] [-C DIR] [-s SCHEMA.json] [-t SECS] "prompt"
```

Defaults: `gpt-5.6-sol`, effort `high`, cwd, 900s timeout. Output is the final agent message
only — progress/reasoning noise never reaches the caller's context. Non-zero exit prints the
log tail to stderr.

Raw incantation, when the wrapper doesn't fit:

```bash
codex exec --skip-git-repo-check --sandbox danger-full-access \
  -m gpt-5.6-sol -c model_reasoning_effort=high \
  -C <dir> -o /tmp/last-msg.txt "<prompt>" </dev/null 2>/dev/null
```

- `</dev/null` mandatory — piped/open stdin hangs exec ("Reading additional input from stdin…").
- `--sandbox danger-full-access` mandatory **on aidev** — bwrap sandboxes fail on this VM
  (`bwrap: loopback: Failed RTM_NEWADDR`). The Claude harness sandbox is the outer containment.
- `-o <file>` writes just the final message; read that, discard stdout/stderr (reasoning
  tokens bloat context).
- Structured output: `--output-schema <file>` — schema must set `additionalProperties: false`
  and list **every** property in `required`.

## Containment discipline

Read-only-by-prompt for opinions/reviews. Anything write-shaped runs in a dedicated git
worktree, and the orchestrator diff-reviews before merge. Never loose in a real checkout.

## Models & sessions

- Available on this plan: `gpt-5.5` (config default), `gpt-5.6-sol` (quality pick). Bare
  `gpt-5.6` / `gpt-5.6-codex` are rejected server-side.
- Multi-turn: `codex exec resume --last` (or `resume <id>`). Chunk long work into
  checkpointed execs — there's no live steering. `--ephemeral` kills resumability.

## Traps

- Global flags (`-a/--ask-for-approval`, `--search`) go **before** `exec`, not after.
- A positional prompt makes piped stdin ignored; to feed stdin as the prompt use `codex exec -`.
- Outside a git repo, `--skip-git-repo-check` is required or codex refuses to run.
- No quota-query surface — on rate-limit errors, back off; GPT quota exhaustion is not a
  Claude problem, just report it.
