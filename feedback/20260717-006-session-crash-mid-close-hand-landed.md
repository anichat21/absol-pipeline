# Fable session died mid-close — run had to be hand-landed by a separate Opus session

- date: 2026-07-17 · project: husk · run: RUN-2026-07-17-6
- component: front door / finalizer

## What happened
A Fable session (spike session: recipe decision on INBOX-033, ADR-0009 + INBOX-055 capture)
died abruptly to a harness glitch mid-close. RUN-2026-07-17-6 had been opened (pre-run
snapshot dc092b9 committed) and a codex handoff for INBOX-032 was being set up — the session
died before the codex prompt was ever written. The owner had to open a separate Opus session
to hand-land everything: session-close commit ff857d7 (ADR-0009, INBOX-055, state.md rewrite,
RUN-6 torn down unstarted). Next-session verification confirmed the hand-landing was complete
and coherent — but it was manual work the pipeline should have owned via crash recovery.

## Expected
Session death mid-run/mid-close is recovered by the front door's crash path (finalizer with
`crashed: yes`) on next open — not by the owner manually driving a different model through
the close ceremony.
