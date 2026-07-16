# Shaper framed patch-vs-proper-fix as if the proper fix were weeks away

- date: 2026-07-14 · project: zei · run: n/a (shaping session)
- component: shaper

## What happened
Shaping BUG-013 (multi-select tag applies to one asset) against INBOX-058 (the full
multi-select tag dialog), the shaper asked: "fold BUG-013 into INBOX-058, or quick-fix
first?" — arguing the quick fix was defensible because "013 is high-priority and on prod,
so ship the dumb loop fix now … and let 058 land properly later." Owner: absol is an AI
working in minutes, not days — the proper fix (058) is one pipeline run away, so an interim
patch is a non-question. The question burned a shaping turn on a dev-team-calendar tradeoff
that doesn't exist here.

## Expected
Never frame options around dev-team time horizons or give time estimates. When the proper
fix is one run away, fold and move on — interim patches only merit a question when
something real blocks the proper fix (unshaped dependency, missing owner input).

## Follow-up
Owner wants a discussion about run timings later (parked, their initiative).
