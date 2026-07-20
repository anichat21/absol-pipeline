# Need a travel mode rulebook — flaky remote access makes interactive flows unusable

- date: 2026-07-18 · project: workspace-wide · run: n/a
- component: front door / all interactive skills

## What happened
User is travelling; network (and therefore Claude remote control) is unreliable — sometimes
can't connect at all. Claude runs in a tmux on aidev, so sessions themselves survive fine,
but anything that blocks on the user mid-task (shaper interviews, scratchpad back-and-forth,
per-action approvals) stalls when the connection drops. Tasks during travel need to be less
interactive and more autonomous.

## Expected
A designed "travel mode" rulebook for absol: bias toward autonomous/AFK-style runs, minimise
mid-task questions, batch decisions up front, and degrade gracefully when the user goes
unreachable mid-session.
