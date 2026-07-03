# No common shipping/versioning or git-branch guidelines — every project invents its own

- date: 2026-07-02 · project: The distillery (surfaced during darkrai pipeline doc session) · run: n/a
- component: front door / project scaffolding (absol-newproject, CLAUDE.md conventions)

## What happened
While cleaning the distillery and barnowl-noir CLAUDE.mds, ops conventions turned out to be
per-project inventions: distillery ships zip drop-ins with version-in-filename + bl_info bumps;
snowowl runs dual worktrees with a pushtoprod script; barnowl-noir does manual NAS→AWAC sync with
commit-on-request. The user then had to ask where versioning rules even belong — CONTEXT.md or
CLAUDE.md — because no absol convention answers it. Same question will recur on every new project.

## Expected
absol ships one common ops convention (shipping checklist, version-bump discipline, git
branch/release rules, where ops rules live: CLAUDE.md = binding ops how-to, CONTEXT.md = domain
glossary only) that absol-newproject scaffolds into new projects and existing CLAUDE.mds inherit,
overriding only where genuinely different.
