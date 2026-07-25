# Scratchpad forbids executor-style agents, but serial background agents were the right shape — owner had to override

- date: 2026-07-25 · project: husk · run: RUN-2026-07-25
- component: scratchpad

## What happened
Owner asked for a multi-task UI build in scratchpad with "Use agents to not inline the whole
thing." Scratchpad's rules allow only the Workflow tool for fan-out; the orchestrator invoked
doctrine (owner's word rewrites rules) and ran three serial Opus general-purpose agents +
two codex passes instead. It worked well: each agent got the prior agent's hand-off notes
inline, files never conflicted (serial by shared-file analysis), the orchestrator kept run.md
events and commits between stages. Workflow would have been the wrong shape — stages were
sequential and each brief depended on the previous result, and the workspace CLAUDE.md notes
Workflow `args` is broken on this harness version anyway.

## Expected
Scratchpad should natively permit serial background agents (executor-shaped briefs, one at a
time, orchestrator holds git and run.md) without an owner override — the ban makes sense for
parallel writers, not for sequential delegation.
