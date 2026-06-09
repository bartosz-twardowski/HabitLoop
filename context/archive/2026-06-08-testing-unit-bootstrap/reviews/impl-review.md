<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Unit Test Bootstrap

- **Plan**: context/changes/testing-unit-bootstrap/plan.md
- **Scope**: All phases (1-3)
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Automated Verification

| Check | Result |
|-------|--------|
| `npm test` | ✅ 61 tests passed (2 files, 685ms) |
| `npm run build` | ✅ Server built in 18.38s |
| `npx eslint` (changed files) | ✅ Clean (2 pre-existing errors on unrelated ownership checks) |

## Findings

### F1 — Oracle anti-pattern in getThreeWeeksAgoDateStr test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/recommendation.test.ts:153-158
- **Detail**: The "matches oldest week from getCompletedWeeks" test case uses production code (`getCompletedWeeks`) to compute the expected value. If `getCompletedWeeks` has a bug, both the tested function and the assertion would be wrong — the test would pass silently. The test plan explicitly prohibits this pattern (S2 Risk #1).
- **Fix**: Replace the production-derived expected value with the literal `"2026-05-18"` (already asserted in the test above), or remove this redundant case entirely.
- **Decision**: FIXED

### F2 — Raw param used instead of validated value in [date].ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/habits/[id]/completions/[date].ts:34
- **Detail**: After validation, the Supabase query uses raw `date` param instead of `dateResult.date`. The other 3 handlers all use the validated output (`freqResult.frequency`, `dateResult.date`). No functional difference today (validator doesn't transform), but breaks the pattern and would silently bypass any future normalization.
- **Fix**: Change `.eq("completed_on", date)` to `.eq("completed_on", dateResult.date)`.
- **Decision**: FIXED

### F3 — Hardcoded error message diverges from validator output

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/habits/index.ts:29
- **Detail**: Uses hardcoded "Frequency must be between 1 and 7" instead of `freqResult.error`. This preserves original behavior (form redirect UX), while the JSON handler (`[id]/index.ts`) uses `freqResult.error`. Intentional — form errors are user-facing, JSON errors are dev-facing.
- **Fix**: No action needed; contextually appropriate.
- **Decision**: SKIPPED

### F4 — Date.parse accepts invalid calendar dates (2026-02-30)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/validation.ts:15
- **Detail**: V8 `Date.parse` rolls "2026-02-30" to Mar 2. Documented in test file with explanatory comment. DB layer catches truly impossible dates. Known limitation accepted during plan review (F2 ACCEPTED).
- **Fix**: No action needed.
- **Decision**: SKIPPED

### F5 — __dirname in vitest.config.ts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: vitest.config.ts:8
- **Detail**: `__dirname` is a CJS global. Would break if `package.json` gets `"type": "module"`. Vitest's transform pipeline handles it today.
- **Fix**: No action needed now.
- **Decision**: SKIPPED
