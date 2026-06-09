# IDOR Protection Integration Tests — Plan Brief

> Full plan: `context/changes/testing-idor-protection/plan.md`
> Research: `context/changes/testing-idor-protection/research.md`

## What & Why

Integration tests proving that all API endpoints accepting a habit ID enforce ownership — User A cannot read or write User B's habits or completions. This covers test-plan Risk #2, the highest-priority uncovered security risk after the unit test bootstrap.

## Starting Point

Vitest is installed with 61 unit tests passing. No integration test infrastructure exists — no mock helpers, no API context builder, no `vi.mock` setup. All 4 endpoints already have ownership checks in production code; this plan proves those checks work and guards against regression.

## Desired End State

Running `npm test` executes 8 new integration tests (2 per endpoint: owner success + attacker 403) alongside existing unit tests. A shared `src/test-utils/api-helpers.ts` module provides reusable mock Supabase client and context factories that future integration tests (Risks #3, #4, #6) will also use.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| Mock strategy | Mock `@/lib/supabase` entirely | Handler ownership logic is the IDOR gate, not client creation; avoids `astro:env/server` blocker | Research |
| Test scope | All 4 endpoints | Complete IDOR coverage; marginal cost per endpoint is low due to identical pattern | Plan |
| Helper location | `src/test-utils/api-helpers.ts` | Reusable across future Risk #3, #4, #6 integration tests | Plan |
| Assertion depth | Status + body shape + no data leak | 403 that leaks data is still a vulnerability; status code alone is insufficient | Plan |

## Scope

**In scope:**
- Mock Supabase client factory with chainable query builder
- API context builder (user identity, params, request body)
- Ownership tests for PATCH habits, POST completions, DELETE completions, POST dismiss-recommendation
- Data leakage checks in 403 responses

**Out of scope:**
- RLS/database-layer testing (would need Docker + local Supabase)
- Auth middleware testing (Risk #3, separate change)
- POST /api/habits create (no habit ID param)
- Happy-path business logic (focus is ownership, not data correctness)

## Architecture / Approach

Direct handler invocation: import the exported `PATCH`/`POST`/`DELETE` function, construct a mock `APIContext` with the desired user identity and params, call the function, assert the `Response`. The mock Supabase client controls what the ownership query returns (data for owner, null for attacker). No server, no database, no Docker.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Test Infrastructure Setup | Mock Supabase client + context factory + smoke test | Chainable mock might not match all handler query patterns |
| 2. IDOR Integration Tests | 8 ownership tests across 4 endpoints | DELETE uses implicit ownership (count-based) — different mock setup than SELECT-based endpoints |

**Prerequisites:** Vitest installed, unit tests passing (done in testing-unit-bootstrap)
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Mock Supabase client must support all chain variations used by handlers (SELECT+maybeSingle, UPDATE+select+single, INSERT+select+single, DELETE+count). If a handler uses an unseen chain, the mock needs extending.
- `*.integration.test.ts` must be matched by the existing vitest include pattern `["src/**/*.test.ts"]` — verified by the smoke test in Phase 1.

## Success Criteria (Summary)

- `npm test` passes with all unit + integration tests green
- Every endpoint tested with owner (success) and attacker (403, no data leak)
- Test helpers are reusable for future Risks #3, #4, #6 integration tests
