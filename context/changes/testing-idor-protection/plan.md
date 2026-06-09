# IDOR Protection Integration Tests — Implementation Plan

## Overview

Write integration tests proving that all 4 API endpoints accepting a habit ID enforce ownership: the owner gets a success response, and a different authenticated user gets 403 with no data leakage. This covers test-plan Risk #2 (User A reads or writes User B's habits or completions).

## Current State Analysis

- **Test infrastructure**: Vitest installed, `@/` alias configured, 61 unit tests passing in 2 files (`recommendation.test.ts`, `validation.test.ts`).
- **No integration test infrastructure**: no mock helpers, no API context builder, no `vi.mock` setup for `@/lib/supabase`.
- **`astro:env/server` blocker**: `src/lib/supabase.ts:3` imports from Astro's virtual module, which doesn't exist in Vitest. Must mock `@/lib/supabase` entirely.
- **4 endpoints with ownership checks**: all follow the same pattern — SELECT habit with `user_id = user.id`, return 403 if null.
- **DELETE completion** uses an implicit ownership pattern (user_id in the DELETE WHERE clause, count === 0 → 403) rather than a separate SELECT.
- **Dual-layer defense**: RLS policies (DB) + handler-level checks (API). This plan tests the handler layer only; RLS is defense-in-depth.

### Key Discoveries:

- All handlers call `createClient(context.request.headers, context.cookies)` first, check `context.locals.user` for auth, then do ownership check — `src/pages/api/habits/[id]/index.ts:33-38`, `src/pages/api/habits/[id]/completions/index.ts:33-38`, `src/pages/api/habits/[id]/completions/[date].ts:29-34`, `src/pages/api/habits/[id]/dismiss-recommendation.ts:20-25`
- `APIRoute` is typed as `(context: APIContext) => Response | Promise<Response>` — handlers can be imported and called directly without a running server
- L-001 fix applied: completions INSERT RLS now checks habit ownership via correlated subquery (`supabase/migrations/20260605000001_completions_insert_ownership.sql`)
- `context.locals.user` is `import("@supabase/supabase-js").User | null` per `src/env.d.ts:3`

## Desired End State

After this plan is complete:

1. `npm test` runs and all integration tests pass alongside existing unit tests.
2. `src/test-utils/api-helpers.ts` provides reusable helpers: `createMockSupabaseClient()`, `createMockContext()`, and the `vi.mock` setup for `@/lib/supabase`.
3. `src/pages/api/habits/[id]/index.integration.test.ts` proves PATCH ownership enforcement.
4. `src/pages/api/habits/[id]/completions/index.integration.test.ts` proves POST completion ownership enforcement.
5. `src/pages/api/habits/[id]/completions/[date].integration.test.ts` proves DELETE completion ownership enforcement.
6. `src/pages/api/habits/[id]/dismiss-recommendation.integration.test.ts` proves dismiss ownership enforcement.
7. Each test asserts: owner → success (200/201), non-owner → 403, 403 body contains only `{ error: string }` (no data leakage).
8. `npm run build` and `npm run lint` still succeed.

**Verification**: run `npm test`, `npm run build`, `npm run lint` — all green.

## What We're NOT Doing

- **RLS/database-layer testing** — would require Docker + local Supabase. Handler-layer ownership checks are the focus.
- **Auth middleware testing** — Risk #3 scope, separate change.
- **Testing POST /api/habits (create)** — no habit ID param, no IDOR surface.
- **Testing happy-path business logic** — the integration tests assert ownership enforcement, not that the update/insert produces correct data.
- **E2e browser tests** — not in scope per test-plan.

## Implementation Approach

Two phases executed sequentially:
1. Build the test infrastructure helpers that future integration tests (Risks #3, #4, #6) will also use.
2. Write the 4 endpoint ownership tests using those helpers.

Each phase is independently verifiable: Phase 1 proves the mock infrastructure works with a smoke test, Phase 2 proves IDOR protection across all endpoints.

## Critical Implementation Details

**Mock Supabase client must be chainable:** Handlers call `.from("habits").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()` — a chain of 5 method calls. The mock must return `this` for each intermediary call and resolve the terminal call (`.maybeSingle()`, `.single()`, `.delete()`) with configurable data. The simplest approach: a builder that records calls and returns a preconfigured result at the terminal method.

**DELETE completion uses a different ownership pattern:** Instead of a separate SELECT → 403 gate, it includes `user_id` in the DELETE clause and checks `count === 0`. The mock must return `{ count: 0, error: null }` for non-owner and `{ count: 1, error: null }` for owner.

---

## Phase 1: Test Infrastructure Setup

### Overview

Create shared test helpers for integration tests: a mock Supabase client factory, an API context builder, and the `vi.mock` wiring. Verify with a minimal smoke test that the mock infrastructure works correctly.

### Changes Required:

#### 1. Update vitest config to include integration tests

**File**: `vitest.config.ts`

**Intent**: Ensure the test runner picks up `*.integration.test.ts` files alongside existing `*.test.ts` unit tests.

**Contract**: The existing `test.include` pattern `["src/**/*.test.ts"]` already matches `*.integration.test.ts` via the `*.test.ts` glob. No config change needed — verify this assumption in the smoke test.

#### 2. Create mock Supabase client factory

**File**: `src/test-utils/api-helpers.ts`

**Intent**: Provide a reusable mock Supabase client that simulates the chainable query builder pattern used by all handlers. Configurable per-test to return different results for owner vs non-owner queries.

**Contract**: Export `createMockSupabaseClient(config)` where config maps table+operation to a result. The mock must support the full chain: `.from(table).select(cols).eq(col, val).eq(col, val).maybeSingle()` → `{ data, error }`, and `.from(table).delete({ count }).eq().eq().eq()` → `{ count, error }`, and `.from(table).update(values).eq(col, val).select(cols).single()` → `{ data, error }`, and `.from(table).insert(values).select(cols).single()` → `{ data, error }`. Each intermediary method returns `this`; terminal methods (`.maybeSingle()`, `.single()`, `.delete()` when called with count option) return the configured result.

#### 3. Create API context builder

**File**: `src/test-utils/api-helpers.ts` (same file)

**Intent**: Provide a factory that builds a minimal `APIContext`-shaped object suitable for passing to imported handler functions. Accepts user identity, route params, request body, and HTTP method.

**Contract**: Export `createMockContext(options)` where options include: `user` (`{ id: string } | null`), `params` (`Record<string, string>`), `method` (string), `body` (unknown, optional), `url` (string, optional). Returns an object satisfying the `APIContext` shape with: `locals.user`, `params`, `request` (standard `Request`), `cookies` (stub with `getAll: () => []`, `set: () => {}`), `redirect` (returns `Response`), `url` (`URL`).

#### 4. Create vi.mock setup helper

**File**: `src/test-utils/api-helpers.ts` (same file)

**Intent**: Export a function or constant that configures `vi.mock("@/lib/supabase")` so that `createClient` returns the mock Supabase client. Tests call this in their setup.

**Contract**: Export `setupSupabaseMock(mockClient)` that calls `vi.mocked(createClient).mockReturnValue(mockClient)`. The test file must call `vi.mock("@/lib/supabase")` at module scope (Vitest requirement) and then use `setupSupabaseMock` in `beforeEach`.

#### 5. Smoke test

**File**: `src/test-utils/api-helpers.test.ts`

**Intent**: Verify that the mock infrastructure works: mock client chains correctly, context builder produces valid objects, and a real handler can be imported and called with the mock context without throwing.

**Contract**: One `describe` with 3 tests: (1) mock client `.from().select().eq().eq().maybeSingle()` returns configured data, (2) `createMockContext` produces object with correct `locals.user` and `params`, (3) import PATCH handler from `@/pages/api/habits/[id]/index`, call with mock context where ownership check returns null, assert 403 response.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with all existing + smoke tests green
- `npm run build` succeeds (test-utils not in production bundle)
- `npm run lint` passes

#### Manual Verification:

- Review that mock client supports the full chain pattern used by handlers
- Review that context builder matches the APIContext shape

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: IDOR Integration Tests

### Overview

Write integration tests for all 4 endpoints that accept a habit ID, proving ownership enforcement. Each test uses two user identities (owner and attacker) and asserts correct status codes plus no data leakage in the 403 response.

### Changes Required:

#### 1. PATCH /api/habits/[id] ownership test

**File**: `src/pages/api/habits/[id]/index.integration.test.ts`

**Intent**: Prove that PATCH only updates habits owned by the authenticated user. Non-owner gets 403 with no habit data.

**Contract**: Two scenarios: (1) Owner sends PATCH with valid frequency → 200, body contains `{ id, frequency }`. (2) Attacker sends same PATCH with same habit ID but different user ID → 403, body is `{ error: "Habit not found" }` with no other keys. Mock setup: ownership SELECT returns `{ data: { id }, error: null }` for owner, `{ data: null, error: null }` for attacker.

#### 2. POST /api/habits/[id]/completions ownership test

**File**: `src/pages/api/habits/[id]/completions/index.integration.test.ts`

**Intent**: Prove that POST completion only works for habits owned by the authenticated user.

**Contract**: Two scenarios: (1) Owner sends POST with valid date → 201, body contains `{ id, completed_on }`. (2) Attacker sends same POST → 403, body is `{ error: "Habit not found" }` with no other keys. Mock setup: same ownership SELECT pattern.

#### 3. DELETE /api/habits/[id]/completions/[date] ownership test

**File**: `src/pages/api/habits/[id]/completions/[date].integration.test.ts`

**Intent**: Prove that DELETE completion only works for the owner's completion rows.

**Contract**: Two scenarios: (1) Owner sends DELETE → 200, body contains `{ ok: true }`. (2) Attacker sends DELETE → 403, body is `{ error: "Completion not found" }` with no other keys. Mock setup differs: DELETE returns `{ count: 1, error: null }` for owner, `{ count: 0, error: null }` for attacker (implicit ownership via user_id in WHERE clause).

#### 4. POST /api/habits/[id]/dismiss-recommendation ownership test

**File**: `src/pages/api/habits/[id]/dismiss-recommendation.integration.test.ts`

**Intent**: Prove that dismiss only works for habits owned by the authenticated user.

**Contract**: Two scenarios: (1) Owner sends POST → 200, body contains `{ ok: true }`. (2) Attacker sends POST → 403, body is `{ error: "Habit not found" }` with no other keys. Mock setup: same ownership SELECT pattern.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with all tests green (unit + integration)
- `npm run build` succeeds
- `npm run lint` passes

#### Manual Verification:

- Review test output to confirm scenario names clearly describe owner vs attacker
- Verify no test imports production data or depends on database state
- Verify each 403 assertion checks for absence of habit/completion data (not just status code)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Integration Tests:

- `src/pages/api/habits/[id]/index.integration.test.ts` — PATCH ownership (2 scenarios)
- `src/pages/api/habits/[id]/completions/index.integration.test.ts` — POST completion ownership (2 scenarios)
- `src/pages/api/habits/[id]/completions/[date].integration.test.ts` — DELETE completion ownership (2 scenarios)
- `src/pages/api/habits/[id]/dismiss-recommendation.integration.test.ts` — dismiss ownership (2 scenarios)

### Key Edge Cases:

- Non-owner gets 403 (not 404) — ambiguous message prevents information disclosure
- 403 response body contains ONLY `{ error: string }` — no habit data leakage
- Owner path exercises the full success flow to verify mock setup is correct
- DELETE uses implicit ownership (count-based) vs explicit SELECT — different mock setup

### Anti-Patterns Avoided (per test-plan S2):

- No over-mocking of auth layer: `context.locals.user` is set directly (this is what middleware produces), not via mocked auth flow
- Two distinct user identities per test: owner `{ id: "owner-uuid" }` and attacker `{ id: "attacker-uuid" }`
- No test depends on database state — all behavior driven by mock Supabase responses

## Performance Considerations

None. Integration tests call handler functions directly with mock data — no network, no database, no server startup. Expected runtime: < 1 second total.

## References

- Research: `context/changes/testing-idor-protection/research.md`
- Test plan: `context/foundation/test-plan.md` (S2 Risk #2)
- Lessons: `context/foundation/lessons.md` (L-001: completions INSERT ownership)
- Handler pattern: `src/pages/api/habits/[id]/index.ts:33-38` (ownership check)
- Supabase client: `src/lib/supabase.ts` (createClient + astro:env/server dependency)
- Prior test bootstrap: `context/changes/testing-unit-bootstrap/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Test Infrastructure Setup

#### Automated

- [x] 1.1 `npm test` passes with all existing + smoke tests green — 8b57e59
- [x] 1.2 `npm run build` succeeds — 8b57e59
- [x] 1.3 `npm run lint` passes — 8b57e59

#### Manual

- [x] 1.4 Mock client supports full chain pattern used by handlers — 8b57e59
- [x] 1.5 Context builder matches APIContext shape — 8b57e59

### Phase 2: IDOR Integration Tests

#### Automated

- [x] 2.1 `npm test` passes with all tests green (unit + integration)
- [x] 2.2 `npm run build` succeeds
- [x] 2.3 `npm run lint` passes

#### Manual

- [x] 2.4 Scenario names clearly describe owner vs attacker
- [x] 2.5 No test imports production data or depends on database state
- [x] 2.6 Each 403 assertion checks for absence of habit/completion data
