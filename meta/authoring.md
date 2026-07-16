# Authoring absol skills & agents

Read before editing anything in `skills/` or `agents/`. This file owns *form*; conduct lives
in `skills/absol/references/doctrine.md` (its **Writing rules** section governs how any rule
is phrased — positive statement, one escape hatch at most) and data shapes live in
`skills/absol/references/schemas.md`.

## One fact, one home

Schemas in schemas.md, conduct in doctrine.md, model evidence in `meta/model-doctrine.md` —
a skill points at the home, never restates it. Needing to state a fact twice means the fact
is homed wrong, not that it should be copied.

## The description is a trigger contract

Frontmatter `description` is the only thing Claude sees before deciding to fire the skill.
Name the affirmative triggers (the exact phrases users say) and the boundary (what it is
*not* for) in one or two sentences. Internal skills say so up front (`[INTERNAL] … invoked
by /absol; don't trigger directly`).

## Derive, don't store

No status flags, no synced state, no "update X when Y changes" choreography. State is
derived at read time — a banner is grepped fresh, liveness is a file's mtime, "planned"
means a plan block exists. A skill that asks an agent to keep two places in sync is
misdesigned; rework it until one of the places disappears.

## Density

Dense prose over bullet confetti; tables only for mechanical matrices (detection →
handling). Give ceremony an explicit budget in the text itself ("six-to-ten lines, no file
dumps") — unbudgeted output grows. A skill that outgrows a couple of screens is carrying
material that belongs in a references file or another component's home.

## Question contract

Everywhere, unchanged: ask only when the answer changes what happens next and ≥2 options
are genuinely defensible; recommendation first; two real options beat three padded.

## Paths survive the symlink

Skills are consumed through `~/.claude/skills/<name>` symlinks, so cross-references use the
symlinked path (`~/.claude/skills/absol/references/…`) or the stable repo path
(`/mnt/nas/dev/projects/absol/…`) — never paths relative to wherever the session happens to
be cwd'd.

## Models

Agents and skills carry no pinned models — they inherit the session. Pin only where a cheap
model is a deliberate, evidenced choice (`meta/model-doctrine.md`). Event records carry
roles (`worker: executor`), never model names.

## Editing discipline

Rewrite to current truth: superseded text is replaced in place, never annotated or stacked
under corrections. When a feedback note folds into a skill, the note is deleted — git
history is the record.
