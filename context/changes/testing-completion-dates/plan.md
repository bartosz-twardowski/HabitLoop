# Completion Date Edge-Case Integration Tests — Implementation Plan

## Overview

Add integration tests proving that `POST /api/habits/[id]/completions` correctly handles
edge-case date scenarios: duplicate completions return 409, backdated dates are stored
verbatim, week-boundary dates are not rounded, and malformed or impossible dates are
rejected with 400 before any database access.

Risk #4 from the test plan: "Completion with edge-case date (backdated, duplicate, timezone
boundary) corrupts the rolling window input data."

## Current State Analysis

The handler at `src/pages/api/habits/[id]/completions/index.ts` already correctly handles
all target scenarios:
- `validateCompletionDate()` rejects non-ISO strings and impossible dates (regex +
  `Date.parse`)
- A `UNIQUE (habit_id, completed_on)` constraint at the DB layer produces Postgres error
  code `23505`, caught by the handler and returned as 409
- The handler stores `completed_on` verbatim — no timezone conversion or week rounding

The existing test file covers: owner→201, attacker→403, unauthenticated→401. It does NOT
cover the date edge cases targeted here.

### Key Discoveries:

- `validateCompletionDate` at `src/lib/validation.ts:10` uses two guards: regex
  `/^\d{4}-\d{2}-\d{2}$/` AND `isNaN(Date.parse(value))` — "2026-02-30" passes regex but
  fails Date.parse
- Error code check at `src/pages/api/habits/[id]/completions/index.ts:40`:
  `if (error.code === "23505")` — mock must set `error.code`, not just `error.message`
- Ownership check (`habits.maybeSingle`) executes BEFORE the insert attempt — duplicate
  tests must configure both `habits.maybeSingle` and `completions.single` mocks, or the
  handler short-circuits at 403
- Validation executes BEFORE the ownership check — invalid-date tests require only
  `setupSupabaseMock` (to pass the 503 guard) and can assert `client.from` was never called

## Desired End State

`src/pages/api/habits/[id]/completions/index.integration.test.ts` contains a new
`describe("POST /api/habits/[id]/completions — date edge cases")` block with 6 tests.
All tests pass under `npm run test` and `npm run lint`.

Verification: `npm run test` shows the 6 new tests green alongside the existing 3.

## What We're NOT Doing

- No production code changes — all target behaviours are already implemented
- No tests for future-date restriction — the handler intentionally allows future dates
- No week-boundary computation tests — rolling-window calculation lives in the
  recommendation engine, not this endpoint; this test only proves the stored date is
  unchanged
- No separate test file — new tests append to the existing `index.integration.test.ts`,
  consistent with the auth-guard change pattern

## Implementation Approach

Append one `describe` block to `index.integration.test.ts`. The block gets its own
`beforeEach` (identical to the existing blocks). Six `it` tests, each following the
established pattern: configure mock client → `setupSupabaseMock` → dynamic import → call
handler → assert status + body + (selected) spy calls.

---

## Phase 1: Add date edge-case describe block

### Overview

Append `describe("POST /api/habits/[id]/completions — date edge cases")` to
`src/pages/api/habits/[id]/completions/index.integration.test.ts` with six tests.

### Changes Required:

#### 1. Append date edge-case describe block to existing test file

**File**: `src/pages/api/habits/[id]/completions/index.integration.test.ts`

**Intent**: Add a new top-level describe block after the existing unauthenticated describe.
The block proves the six date-handling scenarios: duplicate→409, backdated→201,
week-boundary Sunday→201, and three invalid-date variants→400.

**Contract**: Six tests under a single `describe` with its own `beforeEach`. Mock key
mapping for each:

- **duplicate** — `habits.maybeSingle: { data: { id: "habit-1" }, error: null }`,
  `completions.single: { data: null, error: { code: "23505", message: "…" } }` → assert
  status 409, body `{ error: "This day is already logged" }`, and
  `expect(client.eq).toHaveBeenCalledWith("user_id", "owner-uuid")` (proves ownership ran
  before insert attempt)

- **backdated** — `habits.maybeSingle: { data: { id: "habit-1" }, error: null }`,
  `completions.single: { data: { id: "comp-1", completed_on: "2020-01-01" }, error: null }`
  → assert status 201, body includes `completed_on: "2020-01-01"` (no date transformation)

- **week-boundary Sunday** — same mocks, `completed_on: "2026-06-07"` (Sunday) →
  assert status 201, body includes `completed_on: "2026-06-07"` (not rounded to Monday)

- **wrong format** — `createMockSupabaseClient({ results: {} })`, body
  `{ completed_on: "2026/06/09" }` → assert status 400,
  body `{ error: "completed_on must be a valid ISO date (YYYY-MM-DD)" }`,
  `expect(client.from).not.toHaveBeenCalled()`

- **impossible date** — same empty mock, body `{ completed_on: "2026-02-30" }` → assert
  400, same error message, `client.from` not called

- **missing field** — same empty mock, body `{}` → assert 400, same error message,
  `client.from` not called

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test`
- Typecheck passes: `npm run lint`

#### Manual Verification:

- All 6 new tests in the `date edge cases` describe block report green
- `client.from` is not called in any of the three invalid-date tests (confirms validation
  short-circuits before DB access)

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful
before proceeding.

---

## Testing Strategy

### Integration Tests:

- 6 new test scenarios in `describe("POST /api/habits/[id]/completions — date edge cases")`
- Each test imports the handler via dynamic `await import()` after `vi.resetModules()`
- Mock client configured per test via `createMockSupabaseClient({ results: {...} })`
- Key assertions beyond status + body:
  - Duplicate: `client.eq` called with user id (proves ordering: ownership before insert)
  - Invalid dates: `client.from` NOT called (proves early exit before DB access)

### What We Don't Test:

- Future-date restriction (intentionally none)
- Week-assignment arithmetic (recommendation engine, out of scope)
- Timezone offset handling (client sends the date string; handler stores it verbatim)

## References

- Test plan risk #4: `context/foundation/test-plan.md` (line 45)
- Existing test file: `src/pages/api/habits/[id]/completions/index.integration.test.ts`
- Validation module: `src/lib/validation.ts`
- Handler: `src/pages/api/habits/[id]/completions/index.ts`
- Test helpers: `src/test-utils/api-helpers.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Add date edge-case describe block

#### Automated

- [x] 1.1 All tests pass: npm run test
- [x] 1.2 Typecheck passes: npm run lint

#### Manual

- [ ] 1.3 All 6 new tests in date edge cases describe block report green
- [ ] 1.4 client.from not called in invalid-date tests
