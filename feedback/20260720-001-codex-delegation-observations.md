# absol-codex: resume flag-order trap, plus a clean two-phase delegation worth copying

- date: 2026-07-20 · project: artemis-watch · run: n/a (scratchpad-style, no ledger run)
- component: absol-codex

## What happened

Delegated a full LVGL→HTML port (~3,900 lines of firmware UI → a 2,448-line self-contained
simulator) to `codex exec`, in two checkpointed phases. Four observations:

**1. `codex exec resume` rejects the exec flags unless they precede the subcommand.** The
skill documents `codex exec resume --last` for multi-turn work but not the ordering. This
failed outright:

```
codex exec resume --last --skip-git-repo-check --sandbox danger-full-access -m ... -C ... -o ...
→ error: unexpected argument '--sandbox' found
   Usage: codex exec resume --last --skip-git-repo-check [SESSION_ID] [PROMPT]
```

Working form puts every exec-level flag *before* `resume`:

```
codex exec --skip-git-repo-check --sandbox danger-full-access -m gpt-5.6-sol \
  -c model_reasoning_effort=high -C <dir> -o <out> resume --last "<prompt>"
```

Resume then reused session `019f7e6b-…` and phase-1 context carried over intact.
Worth adding to the skill's Traps section next to the existing flag-order note.

**2. Containment by prompt held completely.** Codex ran `--sandbox danger-full-access` with
cwd set to a scratch dir and a "the repo is READ-ONLY, I will diff it" instruction. Across
both phases `git status` on artemis-watch stayed byte-identical to its pre-run baseline. The
cwd-in-scratch + explicit-diff-threat pattern is cheap and worked; no worktree needed for a
read-source/write-elsewhere shape.

**3. It does mutate `~/.codex/config.toml`** — silently appended a
`[projects."/mnt/nas/dev/scratch/artemis-sim"] trust_level = "trusted"` block. Harmless here,
but it means codex writes outside its `-C` dir as a matter of course.

**4. Quality was high and self-reporting was honest.** It corrected a paraphrase error in my
own brief: I wrote "any button while dimmed" wakes the lock, and it went with `LockManager.cpp`
(only Select/Alt wake; Up/Down are swallowed) *and said so* in its reply. Every firmware
constant I spot-checked was exact (220 ms anim, `AnimMs + 30` debounce, dots 1600/450 ms,
lock 10000/6000/800 ms). It respected the "framework must not change" instruction across the
phase boundary — diffing phase 1 vs phase 2 showed 1,198 lines added and only 4 changed, all
in the hardware-stub block it was explicitly allowed to extend. It also volunteered its own
weakest screen for review, unprompted-by-name, and flagged that it could not run a browser
smoke test rather than claiming it had.

Cost: ~11 min phase 1, ~16 min phase 2, $0 marginal.

## Expected

`resume` flag ordering documented in the skill's Traps section, and a line noting codex writes
`trust_level` entries into its own config. The two-phase "framework first, screens second,
tell me if the contract breaks" split is worth promoting as the recommended shape for bulk
ports — the phase-1 diff is what makes the architecture claim verifiable.
