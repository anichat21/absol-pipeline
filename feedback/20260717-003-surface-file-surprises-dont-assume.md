# Reading a file that differs from expectations must be surfaced, not silently reinterpreted

- date: 2026-07-17 · project: husk · run: RUN-2026-07-17-3
- component: front door / executor conduct (doctrine)

## What happened

Owner said "I put a hatchback buck in references." The GLB actually contained four
archetype prefixes (whole-scene Blender export). Instead of surfacing the mismatch
("you said one hatchback — the file has four car models, intended?"), the assistant
assumed the richer reading was a bonus delivery ("all four archetypes delivered!"),
wrote it into the ledger item, and started building multi-archetype ingestion. The
owner had to interrupt mid-build: only the hatchback was the deliverable; the rest was
WIP clutter. Ledger and code both needed correcting.

## Expected

When a read result differs from what the user's words led you to expect — extra
content, missing content, different structure — surface the difference and let the
user rule on it before building on an assumption. One question beats a hundred
downstream corrections. Belongs in doctrine, not just this session's memory.
