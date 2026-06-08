# Unit Test Bootstrap — Plan Brief

> Full plan: `context/changes/testing-unit-bootstrap/plan.md`

## What & Why

Bootstrap Vitest and deliver the first unit tests for HabitLoop, covering the two highest-signal risks from the test-plan Phase 1: Risk #1 (adaptive recommendation produces wrong lower/maintain/raise output) and Risk #5 (API accepts invalid frequency or date, corrupting habit state). No test infrastructure exists today — this change delivers the foundation.

## Starting Point

The project has zero test infrastructure — no runner, no test files, no `test` script. The recommendation engine (`src/lib/recommendation.ts`) is a pure function with private helpers. Frequency and date validation are duplicated inline across four API handlers with no shared module.

## Desired End State

`npm test` runs Vitest with all tests green. `recommendation.test.ts` covers all helper functions and 8-10 hand-calculated scenarios for `computeRecommendation` (all four result kinds + edge cases). `validation.test.ts` covers extracted `validateFrequency` and `validateCompletionDate` with boundary values and malformed inputs. Validation logic in handlers delegates to the shared module — no duplication.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Risk #5 approach | Extract validation to pure functions, unit test them | Cheapest layer; handler-level proof deferred to Phase 2 (integration tests) |
| Helper granularity | Test each helper individually | User preference for precise failure localization over refactor resilience |
| Test file location | Co-located `src/**/*.test.ts` | Vitest/Vite convention; easy to discover next to source |
| Scenario count | 8-10 for computeRecommendation | Covers all 4 result kinds + floor/ceiling/insufficient/partial/suppression edge cases per test-plan |

## Scope

**In scope:**
- Vitest install + config + npm scripts
- Export recommendation helpers for testing
- Unit tests for all recommendation helpers + computeRecommendation scenarios
- Extract validation to `src/lib/validation.ts` + unit tests
- Rewire 4 API handlers to use extracted validation

**Out of scope:**
- Integration tests (Phase 2), CI gates (Phase 3)
- React component tests
- Mocking Supabase or Astro context
- Changing algorithm behavior

## Architecture / Approach

Pure-function testing only — no mocks, no framework context. Extract validation from handlers into a shared module (`src/lib/validation.ts`) to make it testable and eliminate duplication. Vitest config is standalone (not merged into `astro.config.mjs`) to avoid Astro plugin interference.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Vitest Bootstrap | Runner installed, config with `@/` alias, smoke test green | Path alias misconfiguration breaks imports |
| 2. Recommendation Tests | Helpers exported + tested; 8-10 computeRecommendation scenarios | Oracle anti-pattern: accidentally recomputing window in assertions |
| 3. Validation Extract + Tests | Shared validation module, handlers rewired, boundary tests | Refactor changes error messages or status codes in handlers |

**Prerequisites:** None — this is the first test infrastructure.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- `computeRecommendation` currently uses only the most recent week (not multi-week run-length) — tests document current behavior, not PRD aspirational behavior
- Exporting helpers slightly increases the public API surface of `recommendation.ts` — acceptable tradeoff for testability
- `Date.parse("2026-02-30")` behavior varies across JS engines — test may need adjustment if Cloudflare workerd differs from Node

## Success Criteria (Summary)

- `npm test` passes with all unit tests green (recommendation helpers, 8-10 scenarios, validation boundaries)
- `npm run build` succeeds — test files excluded from production bundle
- API handlers return identical error messages and status codes after validation extraction
