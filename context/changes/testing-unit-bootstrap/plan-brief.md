# Unit Test Bootstrap — Plan Brief

> Full plan: `context/changes/testing-unit-bootstrap/plan.md`

## What & Why

Bootstrap Vitest unit tests to defend the adaptive recommendation logic (Risk #1) and input
validation (Risk #5) — the two highest-priority unit-testable risks in the test-plan. This is the
foundational layer before integration tests and CI gates can land.

## Starting Point

Vitest is already installed, configured, and all test files exist. `npm run test` passes 91 tests
(0 failures), including 55 unit tests across `recommendation.test.ts` and `validation.test.ts`.
The "bootstrap" is structurally complete; this plan closes the loop administratively.

## Desired End State

`npm run test` passes with the 55 unit tests green, `test-plan.md` section 6.1 carries the
canonical "how to add a unit test" pattern, and the Phase 1 rollout row is marked `done`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test runner | Vitest | Natural fit for Vite-based Astro stack; already in devDependencies | Plan |
| Test location | `src/lib/*.test.ts` alongside source | Co-location with the module under test; picked up by vitest.config.ts glob | Plan |
| Expected values | Hand-calculated from PRD rules | Prevents oracle anti-pattern called out in Risk #1 response guidance | Plan |
| `today` pinning | Fixed UTC Date in all `computeRecommendation` tests | Deterministic across timezones and CI | Plan |

## Scope

**In scope:** Vitest setup verification; cookbook documentation in test-plan.md; rollout status update.

**Out of scope:** New tests (coverage already complete); source file changes; CI wiring (Phase 3).

## Architecture / Approach

Single phase: confirm `npm run test` exits 0, then update `test-plan.md` section 6.1 with the
canonical unit-test pattern and flip the rollout row to `done`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Verify and lock | Green test run + filled cookbook section | None — tests already pass |

**Prerequisites:** none  
**Estimated effort:** ~1 session, 1 phase

## Open Risks & Assumptions

- `"2026-02-30"` passes `Date.parse()` in V8 (rolls to Mar 2) — documented limitation in
  `validation.test.ts`; deferred to the DB layer, not a blocker.

## Success Criteria (Summary)

- `npm run test` exits 0 with 0 failures
- `test-plan.md` section 6.1 no longer reads "TBD"
- Phase 1 rollout row shows `done`
