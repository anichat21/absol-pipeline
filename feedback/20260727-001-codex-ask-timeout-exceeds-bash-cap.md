# ask.sh default 900s timeout exceeds the harness foreground Bash cap — wrapper dies, codex survives orphaned

- date: 2026-07-27 · project: huntrx · run: RUN-2026-07-27-3
- component: absol-codex (ask.sh wrapper / invocation guidance)

## What happened
Dispatched BUG-034.1 (an execution-sized write task) via
`ask.sh -e medium -C <huntrx> -t 1500 "<brief>"` in a foreground Bash call. Claude Code's
Bash tool hard-caps foreground commands at 600 000 ms; the call died at exactly 10 min with
SIGTERM (exit 143). The codex process itself detached and survived the wrapper — it kept
editing backend/brokers/tastytrade.py and test_chain_fetch.py with its `-o` final-message
file orphaned (wrapper temp path, never printed). Recovery needed a manual `pgrep`, a
background pid-watch loop, and digging the final message out of ~/.codex/sessions rollouts.
The skill's own default (`-t` 900s) cannot ever complete inside a foreground Bash call.

## Expected
The skill should say: anything execution-sized goes through `run_in_background` (or the
wrapper should nohup codex, print the rollout/session path up front, and make a killed
wrapper harmless). A default timeout larger than the harness foreground cap is a trap.
