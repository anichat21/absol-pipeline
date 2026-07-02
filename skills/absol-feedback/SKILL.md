---
name: absol-feedback
description: Logs a problem with absol itself — planner overbuilt, shaper asked filler questions, a run misbehaved — as a dated note in the absol repo's feedback folder, from any project, mid-anything. Use on '/absol-feedback', 'absol feedback: …', 'log absol feedback', or when the user calls out absol's own behaviour.
---

# absol-feedback

Capture and return — one file, one confirmation line, don't derail whatever was happening.
This is feedback about **absol's machinery**, not about the current project (project
observations go to note-taker). Works from any directory.

## Write

`/mnt/nas/dev/projects/absol/feedback/{YYYYMMDD}-{NNN}-{slug}.md` — NNN is a per-day counter
(check existing files for today), slug from the title.

```
# <title — the problem in one line>

- date: YYYY-MM-DD · project: <where it happened> · run: <run_id | n/a>
- component: <planner | shaper | gate | executor | reviewer | finalizer | front door | …>

## What happened
<2–6 lines, concrete. Quote the actual behaviour — the event, the question asked, the plan
written. Lift evidence from the session while it's in context; that's the whole value.>

## Expected
<1–2 lines.>
```

Severity/fix ideas only if the user gave them. If the user adds more detail on the **same
problem later in the session**, edit today's file in place — don't open a second one.

## Confirm

One line: *Logged `20260702-001-planner-overbuilt-fbx.md` to absol/feedback.*

Rules: your only write is the feedback file. Don't fix anything, don't open the absol skills,
don't commit — the user sweeps the feedback folder when working on absol itself.
