# RUN-2026-07-27-3 retrospective — the chaotic attended run that closed 17/17 anyway

- date: 2026-07-27 · project: huntrx (+huntrx-tracker) · run: RUN-2026-07-27-3
- component: whole pipeline — owner-requested retrospective, not a defect report

## What happened

An intense, owner-attended, codex-maxxing run (quota expiring same night), deliberately the
opposite shape of the previous night's clean AFK pipe (RUN-2026-07-27, 16 done, zero drama).
Six item groups planned; scope grew mid-run by three more (051 slice, Roll Radar, archive
move) as the owner answered questions live. Final: 17 done · 0 failed · 6h40m; suites 578
backend / 243 frontend / 82 tracker green; tracker shipped 0.1.1→0.1.3; both intake files
emptied.

## Problems seen, and how they were handled

1. **Codex infra failed twice** — the wrapper's 900s default died against the harness's 600s
   foreground Bash cap (fed back as 20260727-001), and a later exec wedged 80 min polling a
   dead internal shell session (20260727-002). Handling: pid-watch + kill + salvage-from-tree;
   both times the work was complete and verified by suite — zero loss. Lesson already filed:
   the tree, not the wrapper output, is the source of truth.
2. **The owner live-reproduced BUG-034 mid-run** (premarket chain 502s) while the fix for that
   exact bug was mid-execution. Handling: container traceback confirmed the class, the owner's
   "worked at 8am, dead at 12:49" timeline narrowed the API's summary-rollover window. A
   mid-run scare converted into diagnosis evidence.
3. **Adversary plan reviews (codex, ~free) caught 8 spec defects pre-execution** — including a
   quarantine rule that would have laundered $80 of uncertainty into "realized" income and a
   dead-man's-switch rule that read green when the tracker died between sessions. Amendment
   planners re-aimed both plans before any defective code existed. Cheapest correctness of
   the day.
4. **ADR-0021 data-path drift, caught by the owner** ("it was always supposed to go to dev").
   The record proved them right — the ADR's own cross-host premise contradicted the deployed
   path; the drift was located (compose task over-applying the zei convention), the archive
   moved same-day, ADR amended. Two review layers had read past it; owner memory was the
   backstop.
5. **Orchestrator false alarm**: a timezone arithmetic slip produced a "dead tracker" panic
   that was actually "market opens in 31 minutes." Corrected in the open; the habit of
   checking `date -u` before alarming is the takeaway.
6. **The real production failure was three layers deep**: DXLink kills streams on TOTAL
   subscription adds per connection (removes not credited) — established empirically across
   three failed designs (no pacing / 1s pacing / bounded windows with removes), each burning
   a ~35-min live cycle until the discipline changed to scratch-dir scale tests on aidev.
   Behind it hid a latent day-one write bug: live API decimals exceed the frozen
   decimal128(18,6) scale. Fix: connection-per-4k-window + write-boundary half-even
   quantization. Proof: 50,539-row full-universe capture, status=captured.
7. **The dead-man's-switch row validated itself during its own delivery run** — its `danger`
   verdict over the failing tracker was correct the whole time, including when the
   orchestrator briefly didn't believe it.

## How it landed

Everything green, everything pushed, prod containers rebuilt, appliance scale-proven with
the first real archive entry due at that evening's close capture (the new dashboard row is
the watcher). Three eyeball VERIFYs minted (INBOX-056/057/058). Today's open session is a
permanent, honestly-recorded miss — the cost of debugging in production hours.

## The contrast worth keeping

The regular pipe optimizes for unattended correctness; this run showed the same machinery
absorbing live chaos: mid-run capture via note-taker lanes, owner decisions transcribed
without breaking execution, review verdicts re-entering the retry loop, commit-gate salvage
of dead executors, and a finalizer that folded 17 tasks across two repos cleanly. The
event log never lied, which is why recovery was always cheap. Attended intensity is a
supported mode, not a deviation — but live-cycle debugging without a scratch oracle is the
one pattern to never repeat.
