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
| Volume lane: execution batches, review passes, bulk reading, drafts, second opinions | **GPT-5.6-sol via codex** | Field-validated across four husk runs (see 2026-07 evidence below): 7/7 then 9/9 first-try executor batches, plan-review catch rate held at feature scale, honest-verify confirmed against independent re-runs. $0 marginal (ChatGPT sub — the only pool that doesn't drain the Claude window). 2–4× slower wall-clock. Judgment and gates stay on Claude — economics, not quality: planning is low-token/high-judgment, and Claude reviews the plan anyway. |

Cross-cutting rules:
- **A confidently-wrong map costs the orchestrator more than an incomplete one** — weight false positives over recall when picking a reader.
- **The funnel pattern**: big model (Opus/GPT) does discovery → produces the target list → Haiku fans out per target with mandatory file:line citations. The one hallucination incident came from skipping the first step.
- Two independent runs of any model tend to have *different* single misses — union of 2× Opus ≈ perfect map at ~one Sonnet's price.
- Unpinned absol agents inherit the parent (Fable, $10/$50) — ~7× Haiku for no measured reading benefit. Route deliberately.
- **Late-game protocol**: when the Claude 5h window runs hot, judgment stays on Claude, bulk reading/drafting shifts to codex. Haiku is cheap but drains the same Claude window; GPT is a separate pool.
- **Codex is free parallel power** (owner ruling 2026-07-25): read-only codex calls (reviews, reads, opinions) parallelize freely as background calls — no commit gate involved. Writers stay serial on the one checkout. It also shares neither Claude's window nor its attention: an attended Claude session runs at full quality *while* a codex batch executes.
- **Brief style** (owner ruling 2026-07-25): goal + acceptance criteria + constraints inline, never a step-by-step how — the validated runs won because codex planned its own path. Effort split validated: plan `high`, execute `medium`.

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

### Codex field runs — husk, 2026-07 (production evidence, not raced)

- **07-17 executor pilot**: 3 bugs + 4 tweaks, one brief, single exec — 7/7 done, commit per
  item, doctrine held everywhere checked (seam-level fix pre-banned per-card patch; zero
  parallax leftovers), +12 tests, verify green. One unprompted bonus sweep (z-index scale) —
  in-doctrine. Review cost: one diff read.
- **07-21 two-stage plan→execute** (BUG-020 + INBOX-090, feature scale): read-only planning
  pass verified the root cause with file:line citations, caught two accepted ADRs
  contradicting the new design, self-scoped a sanctioned debt convergence. Fresh executor
  landed the approved plan in one exec — 1,744 insertions / 25 files; its verify claim
  matched the orchestrator's independent re-run exactly.
- **07-22 planner+executor AFK run**: 3 plans at effort high (zero retries, exact schema),
  9 executions at medium — 9/9 first-try VERIFY PASS, every mapped trap avoided. Sole
  finding: one stale docstring.

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

Operational usage (incantation, wrapper script, traps, the commit-gate system) lives in the **absol-codex skill** (`skills/absol-codex/SKILL.md`, symlinked into `~/.claude/skills/`) — fires on explicit mention anywhere, and by default for volume work inside absol runs. This doc keeps the evidence; the skill owns the how. Model tiers on this plan: `gpt-5.6-sol` (flagship), `gpt-5.6-terra` (lower-cost, verified 2026-07-25), `gpt-5.5` (superseded).

## Harness facts (Claude Code build as of 2026-07-16)

- Agent-tool model aliases: `sonnet` → claude-sonnet-4-6 (NOT Sonnet 5 — its $2/$10 intro pricing doesn't reach spawned agents), `opus` → claude-opus-4-8[1m], `haiku` → claude-haiku-4-5.
- Per-agent `effort` is settable only via the Workflow tool; the Agent tool has `model` only. Workflow vs Agent: identical model quality; Workflow adds effort control, schema-validated outputs, and keeps bulk results out of the orchestrator's context (use it for future test harnesses). Known workspace bug: Workflow `args` doesn't reach the script — embed data as a `const`.

## Captured candidates (not built — route through the normal absol intake)

- **Usage-aware routing**: no official subscription-usage API exists (Anthropic or OpenAI). Practical path: `ccusage` (not yet installed) estimates the 5h/weekly Claude windows from `~/.claude/projects` JSONL; an `/absol` front-door banner could surface "≈X% of window" and bias routing toward codex late-game. Codex side: catch rate-limit errors only.
- **Codex second-opinion step** on plans before the execute gate — free adversary, proven catch rate. (The helper-script candidate is built: `skills/absol-codex/scripts/ask.sh`.)

## Open tests (next races)

1. **Executor race** — Sonnet vs Opus vs GPT-5.6-sol implementing the same task. Codex-as-executor is now field-validated (2026-07 runs above) but never raced head-to-head against Claude tiers.
2. **Effort dimension** — low vs high on Sonnet/Opus readers, via Workflow.
3. ~~GPT as reader~~ — **raced 2026-07-25** (docs-hub stale/consistency audit, ~4MB text corpus, identical briefs; orchestrator-verified sample of each lane's unique claims):

| Lane | Time | Findings | Sample precision | Character |
|---|---|---|---|---|
| Opus (control) | 8m57s · 299K tokens (Claude window) | **57** | high; 1 direction error | Broadest sweep by far — chrome/theme/structural drift others missed |
| GPT-5.6-sol high | 14m19s · ~275K uncached in + 33K out ($0) | 33 | high; 1 framing error | Deepest *content* reading — semantic contradictions Opus missed (doctrine conflicts, stale data counts) |
| GPT-5.6-terra high | **5m35s** · ~212K uncached in + 16K out ($0) | 14 | high, but sampled not swept | Precise and fast; recall collapses at corpus scale |

   Verdict: sol's reading precision is real — zero false positives in the verified sample —
   so the scout ban lifts; but recall splits by *kind* (Opus sees structure, sol sees meaning),
   and the union covered nearly everything either missed. **Audit-grade reads → Opus + sol in
   parallel, dedupe the union** (sol's lane is free and doesn't touch the Claude window).
   Terra: targeted/pointer-fed reads only, not open-ended sweeps.
