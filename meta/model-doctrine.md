# Minion Model Doctrine — evidence-based routing advisory

2026-07-16. Advisory only — **no `model:` pins in skills/agent frontmatter** (owner decision). The orchestrator consults this when spawning agents; judgment stays free per task.

Evidence base: two blind-judged reading tests + a three-way planner race, all on snowowl-dev, run 2026-07-16. Methods: identical prompts per condition, isolated worktrees, orchestrator-verified answer keys, independent blind Opus judges with codebase verification. (Raw artifacts lived in a session scratchpad, now gone; the tables below are the durable record.)

## The doctrine

| Role | Model | Why (evidence) |
|---|---|---|
| Orchestrate / shape / adjudicate / plan judgment-heavy items | **Fable** | Won the planner race 3/3: only contender to falsify the item's false dependency claim AND correctly decline the baited ACES flip with code-grounded reasoning. Keep it context-light — never bulk reading. |
| Discovery, blast-radius mapping, precision review | **Opus** | Only reading model with 0 false positives (both discovery runs), near-max recall, fastest premium reader, ~half Sonnet's cost. Demoted from planner, not from scout. |
| Max-recall sweeps when a downstream verify pass exists | **Sonnet** | Only model to hit 15/15+6/6 recall on discovery — but 1–2 confabulations per run and ~5× Haiku cost, ~2× Opus time. |
| Pointer-fed extraction, verification, grading, mechanical work | **Haiku** | Perfect (10/10, 0 hallucinations) on targeted reading at ~1/4 cost. **Law: Haiku with a map = perfect; Haiku doing its own discovery = coin flip with confabulation risk.** Never hand it open-ended discovery solo. |
| Second opinions, drafts, dumb-shit bulk, late-session offload | **GPT-5.6-sol via codex** | Beat Opus on planning judgment (n=1). $0 marginal (ChatGPT $20 sub — the only pool that doesn't drain the Claude usage window). 2–4× slower wall-clock. |

Cross-cutting rules:
- **A confidently-wrong map costs the orchestrator more than an incomplete one** — weight false positives over recall when picking a reader.
- **The funnel pattern**: big model (Opus/GPT) does discovery → produces the target list → Haiku fans out per target with mandatory file:line citations. The one hallucination incident came from skipping the first step.
- Two independent runs of any model tend to have *different* single misses — union of 2× Opus ≈ perfect map at ~one Sonnet's price.
- Unpinned absol agents inherit the parent (Fable, $10/$50) — ~7× Haiku for no measured reading benefit. Route deliberately.
- **Late-game protocol**: when the Claude 5h window runs hot, judgment stays on Claude, bulk reading/drafting shifts to codex. Haiku is cheap but drains the same Claude window; GPT is a separate pool.

## Evidence

### Reading round 1 — targeted questions (pointers given)

All 6 runs (2× each) scored 10/10, zero hallucinations — accuracy didn't discriminate, cost did:

| Model | avg tokens | avg time | est. cost/run |
|---|---|---|---|
| Haiku 4.5 | 55.6K | 63s | ~$0.10 |
| Sonnet 4.6 | 72.0K | 133s | ~$0.39 |
| Opus 4.8 | 40.2K | 56s | ~$0.36 |

Opus was the most surgical (~10 tool calls vs Sonnet's ~30) — real cost matched Sonnet despite higher list price. Haiku once out-read the project docs (found `clearSelection()` where CLAUDE.md said `selectPart(null)`).

### Reading round 2 — open-ended blast-radius discovery (no pointers)

Recall over a verified 15-core/6-peripheral consumer set incl. two un-greppable indirect consumers; false positives judge-verified:

| Run | Core /15 | Periph /6 | False pos | Indirect found | Tokens | Time |
|---|---|---|---|---|---|---|
| haiku-1 | 11 | 5 | **4** | missed one | 83.5K | 98s |
| haiku-2 | 14 | 5 | 0 | both | 70.9K | 112s |
| sonnet-1 | **15** | **6** | 2 | both | 133.6K | 262s |
| sonnet-2 | **15** | **6** | 1 | both | 153.0K | 282s |
| opus-1 | 14 | 6 | **0** | both | 52.4K | 124s |
| opus-2 | 14 | 6 | **0** | both | 58.6K | 151s |

### Planner race — INBOX-031 (shadows + N8AO tier), unanimous 3/3 blind ranking

| Rank | Contender | Tasks | Tokens | Time | Est. cost |
|---|---|---|---|---|---|
| 1 | Fable 5 | 2 | 107K | 8.1 min | ~$1.90 |
| 2 | GPT-5.6-sol (codex) | 2 | 152K (+48K failed attempt) | ~15–20 min | $0 marginal |
| 3 | Opus 4.8 | 3 | 92K | 4.0 min | ~$0.85 |

The two baited traps decided it:
- **False dependency claim in the item** ("adds n8ao") — n8ao was already lockfile-pinned via `@react-three/postprocessing` (exports `<N8AO/>`). Fable falsified it; GPT got it right; Opus followed the item into the trap (redundant package add + wrong raw-pass integration).
- **Optional ACES tonemapping flip** — Fable declined with verified reasoning (scene.background CanvasTexture passes through tone mapping → breaks DOM↔canvas match; 70-entry material library tuned under NoToneMapping, human eyeball still owed). GPT safely retained NoToneMapping (unreasoned). Opus flipped it globally as a "one-line cinematic win" — the classic "dumb thing missing" failure.
- Fairness note: judges initially penalized all plans against uncommitted live edits (persist version, GroundPlane floorY); struck after checking HEAD. Post-correction Fable's plan had zero verified errors. Fable's winning plan text is preserved verbatim at `/mnt/nas/dev/output/planner-race-2026-07-16/fable-winning-plan-INBOX-031.md` (with drift notes) — copy it onto the snowowl-dev ledger if INBOX-031 ever runs.
- Codex's first attempt failed **honorably**: when its sandbox broke it refused to fabricate a plan rather than hallucinate. Good failure mode.

## Codex operations

Operational usage (incantation, wrapper script, traps, the commit-gate system) lives in the **absol-codex skill** (`skills/absol-codex/SKILL.md`, symlinked into `~/.claude/skills/`) — triggers only on explicit mention of codex. This doc keeps the evidence; the skill owns the how.

## Harness facts (Claude Code build as of 2026-07-16)

- Agent-tool model aliases: `sonnet` → claude-sonnet-4-6 (NOT Sonnet 5 — its $2/$10 intro pricing doesn't reach spawned agents), `opus` → claude-opus-4-8[1m], `haiku` → claude-haiku-4-5.
- Per-agent `effort` is settable only via the Workflow tool; the Agent tool has `model` only. Workflow vs Agent: identical model quality; Workflow adds effort control, schema-validated outputs, and keeps bulk results out of the orchestrator's context (use it for future test harnesses). Known workspace bug: Workflow `args` doesn't reach the script — embed data as a `const`.

## Captured candidates (not built — route through the normal absol intake)

- **Usage-aware routing**: no official subscription-usage API exists (Anthropic or OpenAI). Practical path: `ccusage` (not yet installed) estimates the 5h/weekly Claude windows from `~/.claude/projects` JSONL; an `/absol` front-door banner could surface "≈X% of window" and bias routing toward codex late-game. Codex side: catch rate-limit errors only.
- **Codex second-opinion step** on plans before the execute gate — free adversary, proven catch rate. (The helper-script candidate is built: `skills/absol-codex/scripts/ask.sh`.)

## Open tests (next races)

1. **Executor race** — Sonnet vs Opus vs GPT-5.6-sol implementing the same task (the biggest absol cost center, wholly untested).
2. **Effort dimension** — low vs high on Sonnet/Opus readers, via Workflow.
3. **GPT as reader** — its reading precision is unmeasured; don't hand it Opus's scout role on one planning datapoint.
