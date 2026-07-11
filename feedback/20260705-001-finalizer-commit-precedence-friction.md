# Finalizer post-run commit makes the user adjudicate absol-vs-project precedence

- date: 2026-07-05 · project: huntrx · run: RUN-2026-07-05
- component: finalizer + front door

## What happened
Clean 7/7 scratchpad run. The finalizer made its post-run commit (`13f1486`, code + ledger fold +
archive as one revertable unit) — correct per absol convention. But three avoidable frictions
landed on the user:

1. **Precedence not encoded.** huntrx's CLAUDE.md says "commit only when explicitly asked." Nothing
   in absol tells the front door / finalizer that absol-driven actions (finalizer commit, ledger
   writes) follow absol's conventions and *override* an older project ask-first rule. So I surfaced
   the commit as a possible rule violation and offered to undo it — making the user adjudicate.
   User's ruling: *"Absol rules > project rules when the action is absol-driven; absol rules are the
   newer, authoritative source."*
2. **Fix misfiled into the project.** My first instinct was to patch the precedence carve-out INTO
   huntrx's CLAUDE.md (absol cross-refs in a project doc). User corrected: *"Absol rules as absol
   feedback, huntrx stuff in huntrx."* Absol-behavior concerns must not be pushed into per-project
   docs.
3. **Env git misreport.** Session env preamble said "Is a git repository: false" but it was a real
   work tree. The finalizer correctly trusted `git rev-parse` and committed, but flagged the
   mismatch to the user.

## Expected
Encode "absol-driven actions follow absol conventions and override conflicting project rules
(incl. git ask-first)" in the finalizer + front-door skills, so a post-run commit is never flagged
as a violation. Keep absol-behavior fixes in absol, never in project docs. Trust `git rev-parse`
over the env preamble and don't raise the mismatch as a user-facing flag when git is unambiguous.

## Firm ruling (user, 2026-07-05)
Make it an actual absol rule, not just guidance: **absol owns git flow. Absol controls git flows
(commit timing, messages, push) unless the user specifies otherwise for a given action.**
Per-project "commit only when explicitly asked" / git-flow rules are therefore redundant and
should NOT live in project docs — absol governs them centrally. Follow-through this session: the
git-flow commit rule was removed from huntrx's CLAUDE.md (repo URL, secrets, and no-force-push
guardrail kept). This rule needs to land in the absol skills on the next sweep so no project
carries (or conflicts with) its own git-flow rule again.
