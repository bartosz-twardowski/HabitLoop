# Completion Date Edge-Case Integration Tests — Plan Brief

> Full plan: `context/changes/testing-completion-dates/plan.md`

## What & Why

Add 6 integration tests to `POST /api/habits/[id]/completions` proving that date edge
cases are handled correctly. Covers test-plan risk #4: "completion with edge-case date
corrupts the rolling window input data."

## Starting Point

The handler already handles all target scenarios correctly — `validateCompletionDate()`
rejects malformed dates, the Postgres unique constraint triggers 409 on duplicates, and
`completed_on` is stored verbatim. The existing test file covers auth and ownership but
has zero date-specific coverage.

## Desired End State

Six new tests in a `describe("date edge cases")` block pass alongside the existing three.
`npm run test` and `npm run lint` both green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| No prod code changes | Tests only | Handler already implements all behaviours |
| Add to existing file | Append to `index.integration.test.ts` | Consistent with auth-guard pattern; all POST /completions tests stay together |
| 6 test cases | Duplicate, backdated, week-boundary, wrong-format, impossible-date, missing-field | Minimum set that exercises every branch of the handler's date path |
| Assert eq spy on duplicate | Yes | Proves ownership check ran before the insert attempt (ordering contract) |
| Assert from not called on invalid dates | Yes | Proves validation short-circuits before DB access |

## Scope

**In scope:**
- `describe("date edge cases")` block with 6 tests appended to existing `index.integration.test.ts`

**Out of scope:**
- Future-date restriction (handler intentionally allows it)
- Week-assignment arithmetic (lives in recommendation engine, not this endpoint)
- Timezone handling beyond "date stored as sent"

## Architecture / Approach

All 6 tests follow the established pattern: `vi.mock` at module scope, `beforeEach` with
`resetModules + clearAllMocks`, `setupSupabaseMock`, dynamic `await import()`. The critical
implementation detail: duplicate tests need BOTH `habits.maybeSingle` and
`completions.single` configured (ownership check precedes insert); invalid-date tests need
only `setupSupabaseMock` and prove `client.from` is never called.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Add date edge-case describe block | 6 new tests, all passing | Error code mock shape (`{ code: "23505" }` not just `message`) |

**Prerequisites:** Vitest and test-utils already bootstrapped (testing-unit-bootstrap)
**Estimated effort:** ~1 session, 1 phase

## Open Risks & Assumptions

- The mock chain's `.single()` terminal resolves the full result object — the `error.code`
  field must be set exactly as `"23505"` (string), matching the handler's strict equality
  check
- `Date.parse("2026-02-30")` must return `NaN` in the test runtime (Node.js); this is
  standard but worth a quick sanity check if the impossible-date test unexpectedly passes
  validation

## Success Criteria (Summary)

- `npm run test` shows 6 new tests green alongside the existing 3
- `npm run lint` passes with no type errors
- `client.from` is not called in any of the three invalid-date tests
