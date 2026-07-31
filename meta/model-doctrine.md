# Minion Model Doctrine — evidence-based routing advisory

2026-07-31. Advisory only — **no `model:` pins in skills/agent frontmatter** (owner decision). The orchestrator consults this when spawning agents; judgment stays free per task.

Evidence base: two blind-judged reading tests + a three-way planner race (snowowl-dev, 2026-07-16; identical prompts, isolated worktrees, verified answer keys, blind Opus judges), then three weeks of production codex runs (husk, huntrx, arctic-tern — evidence sections below). The economics premise: **sol ≈ Opus and terra ≈ Sonnet in intelligence, at ~1/10 the cost on a separate quota pool** — routing follows price-performance, not raw capability, and gets re-cut when the market shifts.

## The doctrine

| Role | Model | Why (evidence) |
|---|---|---|
| Orchestrate / shape / adjudicate / gates | **Fable** | Judgment seat only — context-light, never bulk reading or volume work. Planner **only on explicit owner request**, and even then first judge whether Opus/sol would land the same plan. Operational fragility (owner, 2026-07-31): a run under a Fable orchestrator can't fall back to an Opus orchestrator mid-session — Fable's window dying kills the run. |
| **Planning (default lane)** | **sol split read→plan + independent plan judge** | The 07-30 A/B (arctic-tern INBOX-033): split decisively beat mono — mono shipped hard spec errors; split got decomposition, oracles, and architecture right. The judge was the real lever: its heaviest fixes rested on corpus facts neither reader found. Judge seat: Opus or Fable — cross-vendor independence from the sol drafter. Planner briefs are written in the task schema (planner-in-schema: emit exact `[task]` blocks) so transcription is mechanical. |
| Discovery, blast-radius mapping, precision review | **Opus / sol in parallel** | Opus: 0 false positives on discovery, near-max recall, most surgical reader. sol reads *meaning* where Opus reads *structure* (07-25 docs race) — audit-grade reads take both and dedupe the union; sol's lane is free. |
| End-of-run whole-diff seam review | **sol (standard stage)** | Owner ruling 2026-07-31: near-essential. Every time it has run it caught composition defects per-task review is scoped blind to (07-29 fleet: 24 accepted findings; 07-30: 4 real fix-required defects). |
| Max-recall sweeps when a downstream verify pass exists | **Sonnet / terra** | Sonnet: only model to hit 15/15+6/6 recall — with 1–2 confabulations per run. terra ≈ Sonnet with the 10× buff (owner, 2026-07-31) → terra takes the seat while the buff holds; recall collapses at corpus scale, so pointer-fed/targeted only. |
| Pointer-fed extraction, verification, grading, mechanical work | **Haiku / terra** | Haiku: perfect (10/10, 0 hallucinations) on targeted reading at ~1/4 cost — but drains the Claude window; terra doesn't. **Law: with a map = perfect; own discovery = coin flip with confabulation risk.** Never hand open-ended discovery solo. |
| Volume lane: execution batches, review passes, bulk reading, drafts, second opinions | **sol via codex** | Field-validated: 7/7, 9/9, 17/17 first-try batches; a full pipeline day (recon → 6 plans → 7 executions → seam review) fits in ~20 points of a Plus window (07-30). $0 marginal — the only pool that doesn't drain the Claude window. 2–4× slower wall-clock. Judgment and gates stay on Claude. |

Cross-cutting rules:
- **A confidently-wrong map costs the orchestrator more than an incomplete one** — weight false positives over recall when picking a reader.
- **The funnel pattern**: big model (Opus/GPT) does discovery → produces the target list → Haiku fans out per target with mandatory file:line citations. The one hallucination incident came from skipping the first step.
- Two independent runs of any model tend to have *different* single misses — union of 2× Opus ≈ perfect map at ~one Sonnet's price.
- Unpinned absol agents inherit the parent (Fable, $10/$50) — ~7× Haiku for no measured reading benefit. Route deliberately.
- **Late-game protocol**: when the Claude 5h window runs hot, judgment stays on Claude, bulk reading/drafting shifts to codex. Haiku is cheap but drains the same Claude window; GPT is a separate pool.
- **Codex is free parallel power** (owner ruling 2026-07-25): read-only codex calls (reviews, reads, opinions) parallelize freely as background calls — no commit gate involved. Writers stay serial **per checkout**: writer∥reader validated clean (arctic-tern 07-29), writer∥writer across *different* trees validated clean (07-30, 13-session evening) — the serial rule is per-tree, not global. It also shares neither Claude's window nor its attention: an attended Claude session runs at full quality *while* a codex batch executes.
- **Brief style** (owner ruling 2026-07-25): goal + acceptance criteria + constraints inline, never a step-by-step how — the validated runs won because codex planned its own path. Effort split validated: plan `high`, execute `medium`, judge/review `high`. Brief-compilation mechanics (hazards inline, flag-don't-force, environment reality) live in the absol-codex skill.
- **Parallel reviewer fleets work** (07-29): 5 distinct-lens reviewers over a grouped diff, ~40 min wall-clock, 24/26 findings accepted after adjudication. Distinct lenses > redundant generalists.
- **Two-person planning is the norm** (owner ruling 2026-07-31, evidence 07-30 A/B): a plan gets an independent cross-examiner before the execute gate. The judge with corpus access outranks any reader upgrade.

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
- **07-25 docs-hub fix pass** (loop trial): sol-medium executed 62/64 briefed doc fixes
  across 3 parallel disjoint-checkout execs + one class-audit iteration, preserving each
  doc's voice; its one refusal (flag-don't-force) was correct and beat both the upstream
  reader and the judge's grep spot-check — the executor is a verification layer, not just
  hands. Terra cleared a 4-fix pointer-fed batch in 39s. Grep-based judging is triage, not
  truth: content-blind spot-checks passed a false positive that only full-context reading
  caught.

### Codex UI-smoke capability — huntrx, 2026-07

- **07-26 unattended UI smoke** (RUN-2026-07-26, gpt-5.6-sol effort high, 1 shot): briefed to
  smoke 5 owed VERIFY items against the live app with no existing harness — self-bootstrapped
  Playwright 1.62 in a scratch dir end-to-end, tested both viewports, returned a verdict table
  (3 PASS / 2 PARTIAL) whose failures were all real on inspection (an inert button, a
  truncation blowout with pixel measurements, a tag-DELETE 500, an incidental openapi.json
  404). Verdicts trustworthy. (Same run surfaced a storage-write escalation, now a briefed
  boundary — see absol-codex skill.)

### Codex at pipeline scale — arctic-tern, 2026-07-29/30

- **07-29 codex-fleet evening** (RUN-2026-07-29-2): 13 sol sessions, zero quota pushback —
  7 executors (medium) all green with zero forced edits, 6 judgment sessions (high) incl. a
  5-way distinct-lens reviewer fleet (26 findings, 24 accepted, ~40 min). Validated
  writer∥reader and writer∥writer-across-trees concurrency. Shipped as arctic-tern 0.2.0.
- **07-30 full pipeline day** (RUN-2026-07-30): codex carried recon (8 parallel read-only
  lanes, root-caused 4 bugs, flagged a genuine shape gap pre-planning), 6 plans in strict
  task schema (transcribed near-verbatim), all 7 full-tier executions (tests 55→70, green
  throughout), and the seam review (4 real defects per-task passes missed). Claude did
  ledger, adjudication, smokes, git. Cost: ~20 points of the Plus window for the whole day.
- **07-30 planner A/B** (RUN-2026-07-30-3, INBOX-033): mono read+plan vs split read→plan,
  both sol high, Opus-judged. Mono lost on hard errors (spec that dropped 41 scratchpad runs
  + 30 legacy archives, blanket `verify_oracle: human`); split got structure right and the
  plan-judge's 10 amendments — resting on corpus facts neither reader found — closed the
  gap. Reader choice (sol vs Sonnet) judged near-noise; the judge stage is the lever.
- **Failure modes worth briefing against** (arctic-tern runs): an executor claimed "no
  browser available" while Playwright Chromium sat cached — state environment reality in the
  brief. Source-regex "tests" passed against a real runtime regression — oracle honesty is
  the plan's job (doctrine). A stale smoke server nearly misdiagnosed a correct fix — verify
  against a freshly restarted process before blaming the diff.

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

Operational usage (incantation, wrapper script, traps, brief compilation, the commit-gate
system) lives in the **absol-codex skill** (`skills/absol-codex/SKILL.md`, symlinked into
`~/.claude/skills/`) — fires on explicit mention anywhere, and by default for volume work
inside absol runs. This doc keeps the evidence and the routing; the skill owns the how.
Model tiers on this plan: `gpt-5.6-sol` (flagship, ≈ Opus), `gpt-5.6-terra` (≈ Sonnet,
verified 2026-07-25), `gpt-5.5` (superseded).

## Harness facts (Claude Code build as of 2026-07-31)

- Agent-tool model aliases: `sonnet`, `opus`, `haiku`, `fable` (Claude 5 family generation;
  re-verify concrete IDs per session — they shift with harness updates). The Agent tool
  carries `model`, `subagent_type` (incl. `fork` — inherits full context), and
  `isolation: worktree`.
- Per-agent `effort` is settable only via the Workflow tool's `agent()` opts. **The Workflow
  tool exists in the main session only — subagents don't get it**, so a subagent reporting
  "no Workflow tool" is describing its own toolset, not the harness. Known workspace bug:
  Workflow `args` doesn't reach the script — embed data as a `const` (workspace CLAUDE.md).

## Captured candidates (not built — route through the normal absol intake)

- **Usage-aware routing**: no official subscription-usage API exists (Anthropic or OpenAI). Practical path: `ccusage` (not yet installed) estimates the 5h/weekly Claude windows from `~/.claude/projects` JSONL; an `/absol` front-door banner could surface "≈X% of window" and bias routing toward codex late-game. Codex side: catch rate-limit errors only.

## Open tests (next races)

1. **Executor race** — Sonnet vs Opus vs GPT-5.6-sol implementing the same task. Codex-as-executor is now field-validated (2026-07 runs above) but never raced head-to-head against Claude tiers.
2. **Effort dimension** — low vs high on Sonnet/Opus readers, via Workflow.
3. ~~GPT as reader~~ — **raced 2026-07-25** (docs-hub stale/consistency audit, ~4MB text corpus, identical briefs; orchestrator-verified sample of each lane's unique claims):

| Lane | Time | Findings | Sample precision | Character |
|---|---|---|---|---|
| Opus (control) | 8m57s · 299K tokens (Claude window) | **57** | high; 1 direction error | Broadest sweep by far — chrome/theme/structural drift others missed |
| GPT-5.6-sol high | 14m19s · ~275K uncached in + 33K out ($0) | 33 | high; 1 framing error | Deepest *content* reading — semantic contradictions Opus missed (doctrine conflicts, stale data counts) |
| GPT-5.6-terra high | **5m35s** · ~212K uncached in + 16K out ($0) | 14 | high, but sampled not swept | Precise and fast; recall collapses at corpus scale |

   Verdict: sol's reading precision is real — one false positive total, and it was caught by
   sol *itself* in the executor pass (the "fuzzy vs no-fuzzy" contradiction was Names-vs-
   Materials domain confusion; the fix-batch executor refused the edit with the correct
   citation, beating both the reader and the judge's spot-check) —
   so the scout ban lifts; but recall splits by *kind* (Opus sees structure, sol sees meaning),
   and the union covered nearly everything either missed. **Audit-grade reads → Opus + sol in
   parallel, dedupe the union** (sol's lane is free and doesn't touch the Claude window).
   Terra: targeted/pointer-fed reads only, not open-ended sweeps.
