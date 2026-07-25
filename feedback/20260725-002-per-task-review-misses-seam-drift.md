# Per-task review can't see seam drift — whole-diff review caught 8 defects unit-green tasks hid

- date: 2026-07-25 · project: husk · run: RUN-2026-07-24-2
- component: reviewer

## What happened
Seven tasks executed serially by fresh executors, every one verification-green (937 tests
by the end), every one honestly flagged for review. The review pass ran as ONE whole-diff
adversarial review (codex, per owner spec) instead of absol-reviewer's per-task batches —
and 7 of its 8 confirmed findings were *seam* defects no single task owned: queue-Dismiss
clearing the candidate another task's align session needed, a failed job falling through to
a step an earlier task built, a conversion job racing a slot a later task made replaceable,
an arbiter flag with no owner on unmount. Each task's own acceptance tests passed while the
composition was wrong. absol-reviewer's contract (task entries + their completion events)
would have scoped each of these out of view.

## Expected
For a multi-task item, the review step should include one whole-diff pass over the item
(pre-run commit → tree), not only per-task acceptance checks — the seams are where serial
fresh-context executors fail.
