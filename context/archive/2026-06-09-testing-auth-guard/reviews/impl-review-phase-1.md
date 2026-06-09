<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Guard Integration Tests

- **Plan**: context/changes/testing-auth-guard/plan.md
- **Scope**: Phase 1 of 2
- **Date**: 2026-06-09
- **Verdict**: APPROVED (after triage)
- **Findings**: 0 critical  1 warning  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Supabase-init failure path still redirects instead of returning 503 JSON

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/habits/index.ts:7–9
- **Detail**: The supabase-init guard returned context.redirect(...) while all 3 sibling endpoints return Response.json({ error: "Service unavailable" }, { status: 503 }). The auth change in Phase 1 unified the auth branch but left this guard as a redirect.
- **Fix**: Changed lines 7–9 to `Response.json({ error: "Service unavailable" }, { status: 503 })` to match sibling pattern.
- **Decision**: FIXED

### F2 — Validation errors return redirects (pre-existing, out of scope)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/habits/index.ts:22–28
- **Detail**: Validation errors (missing name, bad frequency) redirect to a UI page — pre-existing before this change. Sibling endpoints return 4xx JSON. Divergence became more visible after the Phase 1 auth fix. Skipped: changing to JSON would break the HTML form UI without a corresponding update to /dashboard/new.
- **Fix**: Track as follow-up — unify to JSON 4xx if endpoint is ever called programmatically or when /dashboard/new is updated to handle JSON errors.
- **Decision**: SKIPPED — too large a scope; would break form UI without accompanying page changes
