# Auth Guard Integration Tests — Plan Brief

> Full plan: `context/changes/testing-auth-guard/plan.md`

## What & Why

Integration tests proving every protected API endpoint rejects unauthenticated requests with 401 JSON. Covers test-plan risk #3: "Unauthenticated request reaches protected route or API endpoint and receives data instead of redirect/401."

## Starting Point

5 protected API endpoints exist. 4 return 401 JSON when `user = null`; one (`POST /api/habits`) returns a 302 redirect. Existing IDOR tests cover ownership but not the unauthenticated scenario. Test infrastructure (Vitest, mock helpers) is fully operational.

## Desired End State

All 5 protected API handlers return 401 JSON for unauthenticated requests. Each has an integration test asserting this. `npm run test` passes with all auth guard scenarios green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Scope | API routes only, no middleware | Middleware is 3 lines; API handlers are the real risk surface |
| Test placement | Add to existing test files | Collocated with IDOR tests; avoids file sprawl |
| Response inconsistency | Unify to 401 before testing | Consistent API contract across all endpoints |
| POST /api/habits coverage | New test file | Only endpoint without any test file |

## Scope

**In scope:** Auth guard (user=null → 401) for all 5 protected API endpoints; unify POST /api/habits response

**Out of scope:** Middleware page redirects, auth routes (public), E2E browser tests, handler refactoring beyond the one fix

## Architecture / Approach

Two-phase approach: (1) fix the one inconsistent handler response, (2) add `describe("unauthenticated")` blocks using existing `createMockContext({ user: null })` helper. No new infrastructure needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Unify auth response | POST /api/habits returns 401 JSON instead of 302 redirect | Frontend form submission may expect redirect (verify manually) |
| 2. Auth guard tests | 5 new test scenarios, one per protected endpoint | None — straightforward mock-and-assert |

**Prerequisites:** Vitest configured, test helpers in `src/test-utils/api-helpers.ts`
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- Frontend habit creation form submits via HTML form action — changing to 401 may require client-side handling if the form relies on redirect. Manual verification in Phase 1 covers this.

## Success Criteria (Summary)

- `npm run test` passes with all auth guard scenarios green
- No protected endpoint leaks data when called without a session
- Consistent 401 JSON contract across all API endpoints
