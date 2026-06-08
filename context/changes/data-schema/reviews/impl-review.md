<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Data Schema (habits + completions with RLS)

- **Plan**: context/changes/data-schema/plan.md
- **Scope**: Phase 1–2 of 2
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unplanned eslint.config.js change

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:77
- **Detail**: Added `{ ignores: ["src/types/database.ts"] }` to the ESLint config. This was not in the plan but is a necessary companion change — the generated Supabase types fail the project's strictTypeChecked ESLint rules without it.
- **Fix**: Document in the plan as an addendum. The change is justified and low-risk; generated files should not be linted.
- **Decision**: FIXED — addendum added to Phase 2 Changes Required in plan.md

### F2 — UPDATE policy on append-only completions table

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260603000001_init_habits_completions.sql:37-38
- **Detail**: The plan specifies — and the migration implements — a `completions_update_own` RLS policy. However, completions are factual records (habit X completed on date Y). Allowing UPDATE lets a user change `completed_on` or reassign `habit_id`, which could corrupt rolling-window calculations. The PRD doesn't mention editing completions, and the "What We're NOT Doing" section doesn't address this.
- **Fix A ⭐ Recommended**: Drop the UPDATE policy via new migration
  - Strength: Reduces mutation surface to insert+delete (the natural model for completion undo). Matches append-only data pattern.
  - Tradeoff: Requires a new migration file. If a future feature needs completion editing, a new migration re-adds it.
  - Confidence: HIGH — no existing code calls UPDATE on completions.
  - Blind spot: Haven't verified if any downstream change (S-02, adaptive-recommendation) uses UPDATE on completions.
- **Fix B**: Accept and document as intentional
  - Strength: Zero code change. Preserves flexibility for future features.
  - Tradeoff: Leaves open a mutation path with no product requirement. A user or buggy code could silently corrupt completion history.
  - Confidence: MEDIUM — acceptable for MVP if no UPDATE callers exist.
  - Blind spot: If a future feature needs UPDATE, adding the policy back is trivial.
- **Decision**: FIXED via Fix A — migration `20260608000001_drop_completions_update_policy.sql` created. Types regeneration pending (requires local Supabase).

### F3 — database.ts reflects later migrations

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/types/database.ts
- **Detail**: The current file includes `recommendation_dismissed_at` (from migration 20260605000002, the adaptive-recommendation change). This is expected — types are regenerated after each schema change per L-002. The file was correct at commit 5ab226e and has been properly updated by subsequent changes. No action needed.
- **Decision**: SKIPPED
