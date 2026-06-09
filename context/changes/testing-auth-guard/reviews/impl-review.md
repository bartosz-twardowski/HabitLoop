<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Guard Integration Tests

- **Plan**: context/changes/testing-auth-guard/plan.md
- **Scope**: Full plan (Phase 1 + Phase 2 of 2)
- **Date**: 2026-06-09
- **Verdict**: APPROVED (after triage)
- **Findings**: 0 critical  2 warnings  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — vi.resetModules() incompatible with hoisted top-level vi.mock()

- **Severity**: ❌ CRITICAL (flagged by agent)
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: wszystkie 5 plików testowych, beforeEach bloki
- **Detail**: Agent flagged vi.resetModules() as incompatible with hoisted vi.mock(). On investigation: vi.resetModules() does NOT affect vi.mock() factory registration per Vitest docs. Pattern is identical to the established testing-idor-protection pattern (commit 1740898). All 80 tests pass.
- **Decision**: DISMISSED — false positive; pattern is correct

### F2 — index.integration.test.ts zawierał tylko test 401; brak owner/authenticated tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/habits/index.integration.test.ts
- **Detail**: File had only the unauthenticated (401) test. POST /api/habits was the only protected endpoint without owner/success path coverage.
- **Fix**: Added describe("authenticated") with two tests: successful creation (302 → /dashboard) and missing name validation (302 → /dashboard/new?error=). Used URLSearchParams form body since handler calls formData().
- **Decision**: FIXED

### F3 — [date].integration.test.ts: brak testu dla error path (500)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/habits/[id]/completions/[date].integration.test.ts
- **Detail**: Pre-existing gap — count-zero 403 path had no coverage for error !== null → 500.
- **Fix**: Added test "returns 500 when database returns an error" with mock returning { count: null, error: { message: "DB error" } }.
- **Decision**: FIXED

### F4 — Struktura unauthenticated describe: top-level zamiast nested (pliki 3–6)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/habits/[id]/*.integration.test.ts
- **Detail**: Minor structural inconsistency — unauthenticated describe is nested in index.integration.test.ts but top-level in the other 4. Tests behave identically.
- **Decision**: SKIPPED — cosmetic only
