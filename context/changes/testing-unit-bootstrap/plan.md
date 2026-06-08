# Unit Test Bootstrap Implementation Plan

## Overview

Bootstrap Vitest and deliver unit tests covering two risks from the test-plan: Risk #1 (adaptive recommendation produces wrong output) and Risk #5 (API accepts invalid frequency/date). This is Phase 1 of the phased test rollout defined in `context/foundation/test-plan.md`.

## Current State Analysis

- **Zero test infrastructure** — no Vitest, no test files, no `test` script in `package.json`.
- **Risk #1 target**: `computeRecommendation()` in `src/lib/recommendation.ts:41-106` is a pure function returning a discriminated union (`lower`/`raise`/`maintain`/`insufficient_data`). Helper functions (`getMondayUTC`, `toISODateStr`, `getCompletedWeeks`, `countInWeek`, `isSuppressed`) are private (not exported).
- **Risk #5 target**: frequency validation (`Number.isInteger(f) && f >= 1 && f <= 7`) and date validation (regex `^\d{4}-\d{2}-\d{2}$` + `Date.parse()`) are duplicated inline across API handlers. No Zod schemas — all validation is plain JS.
- **Build tooling**: Astro 6 + Vite 7 (override) + TypeScript strict. Path alias `@/*` → `./src/*`.

### Key Discoveries:

- Helpers in `recommendation.ts` are module-private (`function`, not `export function`) — they must be exported to test individually (`src/lib/recommendation.ts:8,16,25,37,108`)
- Frequency validation is duplicated in `src/pages/api/habits/index.ts:25` (form) and `src/pages/api/habits/[id]/index.ts:30` (JSON)
- Date validation is duplicated in `src/pages/api/habits/[id]/completions/index.ts:32` and `src/pages/api/habits/[id]/completions/[date].ts:23`
- `computeRecommendation` uses only the most recent available week for its decision (line 71), not multi-week run-length — the algorithm is simpler than the PRD suggests (no consecutive-week run-length threshold yet)
- `isSuppressed` compares timestamps via string `>` on ISO strings — works because ISO 8601 sorts lexicographically

## Desired End State

After this plan is complete:

1. `npm test` runs Vitest and passes with all unit tests green.
2. `src/lib/recommendation.test.ts` covers all helper functions individually and `computeRecommendation` with 8-10 hand-calculated scenarios covering all four result kinds plus edge cases (floor, ceiling, insufficient data, partial week, suppression).
3. `src/lib/validation.test.ts` covers extracted `validateFrequency` and `validateCompletionDate` functions with boundary values and malformed inputs.
4. Validation logic in API handlers delegates to the extracted functions — no duplication.
5. `npm run build` still succeeds (test files excluded from production bundle).
6. `npm run lint` passes with no new warnings.

**Verification**: run `npm test`, `npm run build`, `npm run lint` — all green.

## What We're NOT Doing

- **Integration tests** — handler-level request/response testing is Phase 2 scope.
- **CI wiring** — adding tests to GitHub Actions is Phase 3.
- **React component tests** — HabitCard, CompletionGrid are UI; not in scope for this unit test phase.
- **Mocking Supabase or Astro context** — all tests target pure functions only.
- **Changing algorithm behavior** — tests document current behavior, not fix it.

## Implementation Approach

Three phases executed sequentially:
1. Install Vitest and configure it for the Astro/Vite stack with path aliases.
2. Export recommendation helpers and write comprehensive unit tests with hand-calculated expected values.
3. Extract validation into a shared module, rewire handlers, and write validation unit tests.

Each phase is independently verifiable: Phase 1 proves the runner works, Phase 2 proves Risk #1 coverage, Phase 3 proves Risk #5 coverage.

## Critical Implementation Details

**Oracle anti-pattern (test-plan S2 Risk #1):** Test assertions must use hand-calculated expected values derived from PRD business rules, not recompute the rolling window in the test. For example: "habit created 2026-01-01, frequency 3, completions on Mon/Tue/Wed of week starting 2026-01-13 → count 3, frequency 3 → maintain" — the expected value comes from manually counting, not from calling the production code.

---

## Phase 1: Vitest Bootstrap

### Overview

Install Vitest, create config, add npm scripts, and verify with a trivial smoke test that the runner works with the project's path aliases and TypeScript settings.

### Changes Required:

#### 1. Install Vitest

**Intent**: Add Vitest as a dev dependency. This is the only test runner needed for pure-function unit tests in a Vite-based project.

**Contract**: `npm install -D vitest` adds `vitest` to `devDependencies` in `package.json`.

#### 2. Create Vitest config

**File**: `vitest.config.ts`

**Intent**: Configure Vitest to resolve the `@/*` path alias and use the project's TypeScript settings. Separate from `astro.config.mjs` to avoid Astro plugin interference in test runs.

**Contract**: A standalone `vitest.config.ts` at project root using `defineConfig` from `vitest/config`. Must configure `resolve.alias` for `@/` → `./src/` and set `test.include` to `["src/**/*.test.ts"]`.

#### 3. Add npm scripts

**File**: `package.json`

**Intent**: Add `test` and `test:watch` scripts so the team can run tests with standard commands.

**Contract**: Add to `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

#### 4. Verify with smoke test

**File**: `src/lib/recommendation.test.ts`

**Intent**: Write one trivial test that imports from `@/lib/recommendation` to prove the runner resolves aliases and TypeScript compiles. This test will be replaced with real tests in Phase 2.

**Contract**: A single `describe` + `it` that calls `computeRecommendation` with minimal valid input and asserts the result has a `kind` property.

### Success Criteria:

#### Automated Verification:

- `npm test` runs and the smoke test passes
- `npm run build` succeeds (test files not included in production bundle)
- `npm run lint` passes

#### Manual Verification:

- `npm run test:watch` starts in watch mode and re-runs on file save

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Recommendation Unit Tests

### Overview

Export helper functions from `recommendation.ts` and write comprehensive unit tests covering all helpers individually plus 8-10 scenarios for `computeRecommendation` with hand-calculated expected values.

### Changes Required:

#### 1. Export helper functions

**File**: `src/lib/recommendation.ts`

**Intent**: Make `getMondayUTC`, `toISODateStr`, `getCompletedWeeks`, `countInWeek`, and `isSuppressed` available for direct testing. Currently they are module-private.

**Contract**: Change `function getMondayUTC` → `export function getMondayUTC` (and same for the other four). No behavior change; only visibility.

#### 2. Helper unit tests

**File**: `src/lib/recommendation.test.ts`

**Intent**: Replace the Phase 1 smoke test with dedicated test suites for each exported helper. Tests validate the helpers' contracts independently so failures pinpoint the broken function.

**Contract**: Test suites for:
- `getMondayUTC` — returns Monday 00:00 UTC for dates on each weekday (Mon through Sun), across month/year boundaries
- `toISODateStr` — returns "YYYY-MM-DD" string from UTC Date, handles single-digit months/days with zero-padding
- `getCompletedWeeks` — returns correct week ranges for `count=3`, most-recent first; verifies weeks end strictly before current Monday
- `countInWeek` — counts completions in range `[start, end]` inclusive; returns 0 for empty array; ignores out-of-range dates
- `isSuppressed` — returns false when `dismissedAt` is null; returns true when dismissed and no completions after; returns false when dismissed but completion exists after
- `getThreeWeeksAgoDateStr` — returns correct Monday ISO date string for the 3rd completed week before a known today; verifies it matches the start of the oldest week from `getCompletedWeeks(today, 3)`

#### 3. computeRecommendation scenario tests

**File**: `src/lib/recommendation.test.ts`

**Intent**: Cover all four result kinds plus edge cases with hand-calculated expected values. Each scenario uses a fixed `today` date and manually constructed completion arrays — no production code in assertions (anti-pattern from test-plan).

**Contract**: 8-10 scenarios covering:

1. **Lower** — frequency 3, completions 1 in most recent week → `{ kind: "lower", newFrequency: 2 }`
2. **Raise** — frequency 3, completions 5 in most recent week → `{ kind: "raise", newFrequency: 4 }`
3. **Maintain (exact match)** — frequency 3, completions 3 → `{ kind: "maintain" }`
4. **Floor (freq=1, under-performing)** — frequency 1, completions 0 → `{ kind: "maintain", explanation includes "minimum" }`
5. **Ceiling (freq=7, over-performing)** — frequency 7, completions 7+ → `{ kind: "maintain", explanation includes "maximum" }`
6. **Insufficient data (<2 weeks)** — habit created recently, < 2 available weeks → `{ kind: "insufficient_data", daysUntilFirst: N }` where N is hand-calculated
7. **Partial week** — habit created mid-week, only 1 full week available → insufficient_data
8. **Suppression (dismissed, no new completions)** — lower result with `suppressed: true`
9. **Suppression cleared (new completion after dismiss)** — lower result with `suppressed: false`
10. **Zero completions, freq > 1** — frequency 5, completions 0 → `{ kind: "lower", newFrequency: 4 }`

All expected values derived from PRD rules: count < freq → lower (unless floor), count > freq → raise (unless ceiling), count === freq → maintain.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with all recommendation tests green
- `npm run lint` passes (exported functions don't break existing imports)
- `npm run build` succeeds

#### Manual Verification:

- Review test output to confirm scenario names clearly describe the business case being tested
- Verify no test assertion recomputes the rolling window — all expected values are literal constants

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Validation Extract + Unit Tests

### Overview

Extract frequency and date validation from inline handler code into pure functions in `src/lib/validation.ts`, update handlers to call the extracted functions, and write unit tests covering boundary values and malformed inputs.

### Changes Required:

#### 1. Create validation module

**File**: `src/lib/validation.ts`

**Intent**: Centralize frequency and date validation logic that is currently duplicated across 4 API handlers. Each function takes a raw `unknown` input and returns a typed result or validation error.

**Contract**:
- `validateFrequency(value: unknown): { valid: true; frequency: number } | { valid: false; error: string }` — checks type is number, is integer, is in range [1, 7]
- `validateCompletionDate(value: unknown): { valid: true; date: string } | { valid: false; error: string }` — checks type is string, matches `^\d{4}-\d{2}-\d{2}$`, parses to valid Date

#### 2. Rewire habit creation handler

**File**: `src/pages/api/habits/index.ts`

**Intent**: Replace inline frequency validation with a call to `validateFrequency`. The handler still coerces from form data (`Number(freqRaw)`) before calling the validator.

**Contract**: Import `validateFrequency` from `@/lib/validation`. Replace lines 25-27 (inline check + redirect) with a call to the validator and the same redirect on `valid: false`.

#### 3. Rewire habit update handler

**File**: `src/pages/api/habits/[id]/index.ts`

**Intent**: Replace inline frequency validation with `validateFrequency`.

**Contract**: Import `validateFrequency` from `@/lib/validation`. Replace lines 29-32 (inline check + JSON error) with validator call and same 400 response on failure.

#### 4. Rewire completion create handler

**File**: `src/pages/api/habits/[id]/completions/index.ts`

**Intent**: Replace inline date validation with `validateCompletionDate`. Remove the local `ISO_DATE_RE` constant.

**Contract**: Import `validateCompletionDate` from `@/lib/validation`. Replace lines 29-34 (extract + inline check) with validator call and same 400 response on failure.

#### 5. Rewire completion delete handler

**File**: `src/pages/api/habits/[id]/completions/[date].ts`

**Intent**: Replace inline date validation with `validateCompletionDate`.

**Contract**: Import `validateCompletionDate` from `@/lib/validation`. Replace the inline regex+parse check with validator call.

#### 6. Validation unit tests

**File**: `src/lib/validation.test.ts`

**Intent**: Test both validators at boundary values and with malformed inputs. These tests prove Risk #5 protection: the validation functions reject bad input before it reaches the database.

**Contract**: Test suites for:

`validateFrequency`:
- Valid: 1, 4, 7 → `{ valid: true, frequency: N }`
- Invalid boundary: 0, 8, -1 → `{ valid: false }`
- Invalid type: 3.5, NaN, Infinity, "abc", null, undefined, `{}` → `{ valid: false }`

`validateCompletionDate`:
- Valid: "2026-06-08", "2026-01-01", "2025-12-31" → `{ valid: true, date: "..." }`
- Invalid format: "not-a-date", "2026/06/08", "06-08-2026", "2026-6-8" → `{ valid: false }`
- Invalid date: "2026-02-30", "2026-13-01" → `{ valid: false }`
- Invalid type: 123, null, undefined, `{}` → `{ valid: false }`

### Success Criteria:

#### Automated Verification:

- `npm test` passes with all tests green (recommendation + validation)
- `npm run build` succeeds
- `npm run lint` passes
- Type check passes: `npx astro check`

#### Manual Verification:

- Review that API handlers still return the same error messages and status codes as before the refactor
- Spot-check one handler (e.g. POST /api/habits) to confirm the validation call site reads cleanly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/recommendation.test.ts` — helpers (5 functions) + computeRecommendation (8-10 scenarios)
- `src/lib/validation.test.ts` — validateFrequency (~10 cases) + validateCompletionDate (~10 cases)

### Key Edge Cases:

- Floor: frequency=1, under-performing → maintain (not lower)
- Ceiling: frequency=7, over-performing → maintain (not raise)
- Insufficient data: habit created < 2 complete weeks ago
- Partial week: habit created mid-week affects available week count
- Suppression: dismissed recommendation suppressed until new completion
- Boundary values: frequency 0, 8, -1, 3.5; date "2026-02-30", "not-a-date"

### Anti-Patterns Avoided (per test-plan S2):

- No oracle problem: all expected values are hand-calculated literals, never recomputed from production code
- No Zod-only testing: validation functions are tested, but handlers will be proven to call them in Phase 2 (integration tests)

## Performance Considerations

None. Unit tests run in < 1 second for this scope. No filesystem, network, or database access.

## References

- Test plan: `context/foundation/test-plan.md` (S2 Risk Map, Risk Response Guidance)
- Recommendation engine: `src/lib/recommendation.ts`
- API handlers: `src/pages/api/habits/index.ts`, `src/pages/api/habits/[id]/index.ts`, `src/pages/api/habits/[id]/completions/index.ts`, `src/pages/api/habits/[id]/completions/[date].ts`
- Lessons: `context/foundation/lessons.md` (L-003: runtime validation mandate)
- PRD: `context/foundation/prd.md` (FR-004, FR-007, US-01)
- Archived recommendation plan: `context/archive/2026-06-05-adaptive-recommendation/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Bootstrap

#### Automated

- [x] 1.1 `npm test` runs and smoke test passes — 6bb14cf
- [x] 1.2 `npm run build` succeeds — 6bb14cf
- [x] 1.3 `npm run lint` passes — 6bb14cf

#### Manual

- [x] 1.4 `npm run test:watch` starts in watch mode and re-runs on file save — 6bb14cf

### Phase 2: Recommendation Unit Tests

#### Automated

- [x] 2.1 `npm test` passes with all recommendation tests green
- [x] 2.2 `npm run lint` passes
- [x] 2.3 `npm run build` succeeds

#### Manual

- [x] 2.4 Review test output — scenario names clearly describe business case
- [x] 2.5 Verify no assertion recomputes rolling window — all expected values are literals

### Phase 3: Validation Extract + Unit Tests

#### Automated

- [ ] 3.1 `npm test` passes with all tests green (recommendation + validation)
- [ ] 3.2 `npm run build` succeeds
- [ ] 3.3 `npm run lint` passes
- [ ] 3.4 `npx astro check` passes

#### Manual

- [ ] 3.5 API handlers return same error messages and status codes as before refactor
- [ ] 3.6 Validation call sites in handlers read cleanly
