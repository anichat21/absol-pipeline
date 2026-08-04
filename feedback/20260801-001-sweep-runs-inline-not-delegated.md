# Sweep runs inline in the front-door session instead of delegating

- date: 2026-08-01 · project: huntrx · run: n/a
- component: absol-sweep

## What happened
"Absol sweep" after opening huntrx ran the whole drain loop inline in the main session: 6 dots
fetched, each classified through note-taker conduct, 5 `add`s + 1 `update` + 6 DELETEs — all as
main-loop tool calls. The sweep skill's loop (fetch → grep uuid → note-taker capture → delete)
is mechanical and self-contained, yet it consumed main-session context and turns.

## Expected
Sweep should be delegated (subagent per sweep, or per project), not run inline — the front
door should just get the one-line confirm back.
