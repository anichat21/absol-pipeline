# Absol Workflow Schemas

All markdown data files use these compact, machine-readable schemas. Each item is a markdown list block with stable field names. Avoid prose — keep entries scannable.

---

## inbox.md — `[item]`

```
- [item]
  - id: INB-001
  - title: Short descriptive title
  - raw_request: Original request text (verbatim or lightly cleaned)
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - priority: critical | high | medium | low
  - subsystem: affected area (e.g. auth, api, ui, db)
  - route: inbox | plan
  - batchable: yes | no
  - needs_arch_review: yes | no
  - status: new | triaged | promoted | rejected
```

---

## plan.md — `[plan-item]`

```
- [plan-item]
  - id: PLN-001
  - title: Short descriptive title
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - problem: What is wrong or missing
  - proposed_direction: How to approach it
  - integration_notes: How it fits existing architecture
  - prerequisites: IDs or descriptions of things that must happen first
  - risks: What could go wrong
  - status: new | shaping | ready | blocked | done
```

---

## todo.md — `[task]`

```
- [task]
  - id: TSK-001
  - type: ARCH | FEATURE | BUG | TWEAK | CHORE
  - title: Short descriptive title
  - description: What to do (concrete, actionable)
  - subsystem: affected area
  - dependencies: TSK-xxx, TSK-yyy (or: none)
  - acceptance_criteria: How to verify done
  - verification: Command or check to run
  - risk: low | medium | high
  - batching_hint: grouping suggestion (e.g. "auth-cleanup", "api-v2")
  - parallelizable: yes | no
  - status: pending | in-progress | done | failed | blocked
```

---

## todo-run.md — `[job]`

```
- [job]
  - batch_id: BAT-001
  - task_id: TSK-001
  - status: running | done | failed | blocked | needs-review
  - worker: sonnet | opus
  - files_touched: path/a.ts, path/b.ts
  - summary: One-line description of what was done
  - verification_result: pass | fail | skipped
  - blocker: Description of blocker (or: none)
  - review_flag: yes | no
```

---

## Batch output — `[batch]`

```
- [batch]
  - id: BAT-001
  - title: Short batch description
  - included_tasks: TSK-001, TSK-002, TSK-003
  - blocked_tasks: TSK-004 (reason)
  - parallel_groups: [TSK-001, TSK-002] | [TSK-003]
  - serial_chain: TSK-001 → TSK-003 (if dependency)
  - notes: Any relevant context
```

---

## Review output — `[review]`

```
- [review]
  - task_id: TSK-001
  - reviewer: sonnet | opus
  - verdict: approved | fix-required | blocked | human-check
  - evidence: What was checked and observed
  - issues: List of problems found (or: none)
  - fix_request: What needs to change (or: n/a)
  - human_check: yes | no
```

---

## ID Conventions

| Prefix | Source |
|--------|--------|
| INB-   | inbox.md items |
| PLN-   | plan.md items |
| TSK-   | todo.md tasks |
| BAT-   | batch output |

IDs are monotonically increasing within each file. When promoting items between files (e.g. inbox → plan → todo), create a new ID in the target file and reference the source ID in the description or notes.

## Task Classes

| Class | Use for |
|-------|---------|
| ARCH | Architectural changes, refactors that alter system structure |
| FEATURE | New user-facing functionality |
| BUG | Broken behavior that needs fixing |
| TWEAK | Small improvements to existing behavior |
| CHORE | Maintenance, deps, config, docs, cleanup |
