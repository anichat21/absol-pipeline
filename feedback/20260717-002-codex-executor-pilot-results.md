# Codex-as-executor pilot on husk — 7/7 done, doctrine held, review overhead small

- date: 2026-07-17 · project: husk · run: n/a (owner opted out of run tracking for the experiment)
- component: executor (codex lane, experimental)

## What happened

Owner asked to test GPT as the executor for a mechanical batch: 3 bugs + 4 tweaks from
v0.0.7 desktop feedback (BUG-002..004, INBOX-042/043/044/047). Setup: dedicated worktree,
one written brief (items with acceptance criteria + binding doctrine rules + capped verify
command + commit-per-item), single `codex exec` via ask.sh (gpt-5.6-sol, ~35 min), Claude
diff-reviewed after.

Results: 7/7 done, one commit per item as instructed, plus an unprompted 8th commit
sweeping literal z-indexes onto the canonical `--layer-*` scale. Doctrine held everywhere
checked: BUG-002's toggle fixed at the dismiss.ts seam (per-card fix was pre-banned in the
brief), parallax removed mechanism-and-all (zero leftovers on grep), Button primitive used,
no literal z-index anywhere. Added 12 tests; verify fully green 645/645 after fixture
symlink (codex correctly diagnosed its 6 "failures" as missing gitignored fixtures).
Merged ff to main. One design nuance flagged in review, not blocking: its click-suppression
makes switching between two open-able cards (account→pause) cost two clicks.

## Expected

This is the positive datapoint for the codex executor lane: brief-driven mechanical batches
work when the brief carries doctrine + acceptance criteria and Claude reviews the diff.
Review cost was low (one diff read). Open before it becomes a real lane: device check still
pending (feel-level regressions invisible in diff review), and untested on ambiguous or
design-shaped items — this batch was deliberately the easy seven.

Owner addendum (same day): the deeper win is concurrency, not cost — codex shares neither
Claude's usage window nor its attention, so an attended discussion/shaping session with
Claude can run at full quality WHILE a codex batch executes in the background (this session
did exactly that: ADR-0008 concurrency clause was shaped mid-batch). Lane-routing rule that
falls out: mechanical + plural → codex with a doctrine-carrying brief and mandatory Claude
diff review; singular or judgment-shaped → Claude. Brief-writing + review are fixed costs,
so the lane only pays at batch size.
