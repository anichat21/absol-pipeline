---
name: absol-sweep
description: Sweeps ArcticTern annotation dots into project ledgers — each dot's note is captured through note-taker in the project its route names, then deleted from the store (copy → verify → delete). Scopes to the current project when run inside one; whole workspace otherwise or on 'sweep all'. Use on '/absol-sweep', 'sweep the dots', 'sweep annotations'. On-demand only.
---

# absol-sweep

Drains the ArcticTern annotation queue into the ledgers. The store is a capture queue, empty
in the steady state (ADR:
`/mnt/nas/dev/projects/arctic-tern/.absol/adr/0002-annotation-sidecar-store.md`). Dots are
written as note-taker utterances, so each note goes straight through note-taker
(`~/.claude/skills/note-taker/SKILL.md`) in the project the dot belongs to — routing lives
there.

## Scope

Inside a project (walk up from cwd to `.absol/`): only dots whose route names that project.
Outside one, or on an explicit "all": every routable dot in the store.

A dot is routable when its `doc` route carries a slug — `/tracker/<slug>[…]` or
`/docs/<slug>/…` — and `/mnt/nas/dev/projects/<slug>/.absol/` exists. Everything else
(`/`, `/kb`, bare `/tracker`, knowledge_base slugs) stays in the store untouched — the owner
handles those directly.

## Loop — one dot at a time

API: `http://aidev:8191/api/annotations` (prod). API only — the store file and port 8191
belong to the running prod server.

1. `GET /api/annotations`; keep the routable dots in scope.
2. Grep the project's three intake files for the dot's uuid — found means an earlier sweep
   died between copy and delete: skip to 4.
3. Capture the dot's `note` through note-taker in the dot's project (its route decides the
   project) — full note-taker conduct: classification, enrich when it names an existing item,
   toolset writes. New items get a trailing `swept: <uuid>` line in the description; shape
   transcriptions carry nothing (re-transcription is harmless — rewrite to current truth).
4. Only after note-taker's confirm line: `DELETE /api/annotations?id=<uuid>`. Delete failed →
   report it and stop; the uuid line makes the rerun safe.

## Confirm

One line per project: **huntrx**: INBOX-055, BUG-012 added, noted on INBOX-029's shape.
Tail when applicable: *3 non-routable dots left in the store.* Empty store: *nothing to
sweep.*

Rules: your writes are ledger writes under note-taker's rules and DELETEs of dots captured
this session — nothing else. A dot that fails capture stays in the store.
