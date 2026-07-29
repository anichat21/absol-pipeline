# Parallel codex sessions: validated (writer + reader, concurrent)

- date: 2026-07-29 · project: arctic-tern · run: RUN-2026-07-29-2
- component: codex skill

## What happened
Owner-requested test: two `codex exec` sessions launched simultaneously as background
`ask.sh` calls — a writer (INBOX-031 Apps row, `-C` arctic-tern, effort medium) and a
reader (INBOX-039 KB staleness audit, `-C` workspace root, read-only brief, effort high).
Both completed cleanly with no interference, no rate-limit errors, no stdin/session
collisions. Writer returned first (~25 min, full feature + 47/47 tests + its own 8199
smoke); reader followed (~35 min, high-quality cited audit that found the KB entry doesn't
exist at all). A third session (SCR.1 UI round, 5 items) had already run solo earlier the
same evening — three heavy sessions in one evening, no quota pushback on the Plus window.

## Expected / takeaway
The skill's "writers stay serial on the one checkout, readers parallelize freely" rule is
confirmed workable in practice — writer+reader concurrency is safe and roughly halves
wall-clock. Nothing observed yet justifies relaxing it to parallel writers in one tree.
Two-writer parallelism across *different* repos remains untested.
