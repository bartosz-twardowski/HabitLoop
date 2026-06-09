# Auth Guard Integration Tests — Implementation Plan

## Overview

Add integration tests proving every protected API endpoint rejects unauthenticated requests (`context.locals.user = null`) with a consistent 401 JSON response. Before writing tests, unify the one inconsistent endpoint (`POST /api/habits`) which currently returns a 302 redirect instead of 401.

Risk #3 from the test plan: "Unauthenticated request reaches protected route or API endpoint and receives data instead of redirect/401."

## Current State Analysis

The middleware (`src/middleware.ts:4`) defines `PROTECTED_ROUTES = ["/dashboard", "/habits"]` and redirects unauthenticated users to `/auth/signin` for page requests. Each API handler also checks `context.locals.user` independently — this is the layer we're testing.

### Key Discoveries:

- 5 protected API endpoints exist; 4 return `401 JSON` when `user = null`, 1 returns `302 redirect` (`src/pages/api/habits/index.ts:12-14`)
- 4 existing integration test files cover IDOR (ownership) but none test the `user = null` scenario
- `POST /api/habits` has no test file at all
- Test infrastructure is ready: `createMockContext({ user: null })` + `setupSupabaseMock()` in `src/test-utils/api-helpers.ts`

## Desired End State

Every protected API endpoint:
1. Returns `401` with `{ error: "Unauthorized" }` JSON body when called without a session
2. Has at least one test asserting this behavior
3. Never leaks data or performs side effects for unauthenticated callers

Verification: `npm run test` passes with all new auth guard scenarios green.

## What We're NOT Doing

- Middleware-level tests for `.astro` page redirects — middleware is 3 lines of `startsWith` logic; API handler tests cover the real risk
- Refactoring handler auth patterns beyond the one inconsistency fix
- Testing auth routes (`signin`, `signup`, `signout`) — these are intentionally public
- E2E browser tests

## Implementation Approach

Phase 1 fixes the one production inconsistency (redirect → 401) so all API handlers share the same contract. Phase 2 adds `describe("unauthenticated")` blocks to each test file with a single scenario: call the handler with `user: null`, assert 401 + JSON error body.

---

## Phase 1: Unify POST /api/habits auth response

### Overview

Change `POST /api/habits` to return `401 JSON` instead of `302 redirect` when `user = null`, matching the pattern used by all other API routes.

### Changes Required:

#### 1. Fix auth response in habit creation handler

**File**: `src/pages/api/habits/index.ts`

**Intent**: Replace the redirect-based auth rejection with a 401 JSON response to match the contract established by the other 4 API handlers.

**Contract**: When `context.locals.user` is null, return `Response.json({ error: "Unauthorized" }, { status: 401 })` instead of `context.redirect("/auth/signin")`.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `npm run lint`
- All existing tests still pass: `npm run test`

#### Manual Verification:

- Calling `POST /api/habits` without a session returns 401 JSON (verify via browser devtools or curl-equivalent)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add unauthenticated test scenarios

### Overview

Add a `describe("unauthenticated")` block to each of the 5 protected API endpoint test files, asserting that `user: null` → `401` + `{ error: "Unauthorized" }`.

### Changes Required:

#### 1. New test file for POST /api/habits

**File**: `src/pages/api/habits/index.integration.test.ts` (new file)

**Intent**: Create integration test for the habit creation endpoint covering the auth guard scenario. Uses the same mock pattern as existing IDOR tests: `vi.mock`, `createMockContext({ user: null })`, assert `response.status === 401`.

**Contract**: Exports a `describe("POST /api/habits")` with nested `describe("unauthenticated")` containing one test: call `POST` handler with `user: null`, verify 401 status and `{ error: "Unauthorized" }` JSON body.

#### 2. Add auth guard test to PATCH /api/habits/[id]

**File**: `src/pages/api/habits/[id]/index.integration.test.ts`

**Intent**: Add a `describe("unauthenticated")` block with one test verifying `user: null` → 401.

**Contract**: New describe block after the existing IDOR tests; same setup pattern (`createMockContext({ user: null, params: { id: "any-id" } })`), assert 401.

#### 3. Add auth guard test to POST /api/habits/[id]/completions

**File**: `src/pages/api/habits/[id]/completions/index.integration.test.ts`

**Intent**: Add unauthenticated scenario to the completions creation test file.

**Contract**: Same pattern — `describe("unauthenticated")`, `user: null`, assert 401.

#### 4. Add auth guard test to DELETE /api/habits/[id]/completions/[date]

**File**: `src/pages/api/habits/[id]/completions/[date].integration.test.ts`

**Intent**: Add unauthenticated scenario to the completion deletion test file.

**Contract**: Same pattern — `describe("unauthenticated")`, `user: null`, assert 401.

#### 5. Add auth guard test to POST /api/habits/[id]/dismiss-recommendation

**File**: `src/pages/api/habits/[id]/dismiss-recommendation.integration.test.ts`

**Intent**: Add unauthenticated scenario to the recommendation dismissal test file.

**Contract**: Same pattern — `describe("unauthenticated")`, `user: null`, assert 401.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test`
- Typecheck passes: `npm run lint`

#### Manual Verification:

- Review test output: all 5 `unauthenticated` describe blocks report green
- No Supabase query method was called in any unauthenticated test (handlers should short-circuit before DB access)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Integration Tests:

- 5 new test scenarios (one per protected endpoint), all following the same pattern:
  1. Create mock context with `user: null`
  2. Call handler
  3. Assert `response.status === 401`
  4. Assert `response.json()` returns `{ error: "Unauthorized" }`
- Optionally assert that Supabase query methods (`from`, `select`, etc.) were NOT called — proves early exit

### What We Don't Test:

- Middleware redirect behavior (out of scope)
- Valid authenticated requests (covered by existing IDOR tests)
- Auth routes (intentionally public)

## References

- Test plan risk #3: `context/foundation/test-plan.md` (line 43)
- Existing test helpers: `src/test-utils/api-helpers.ts`
- Existing IDOR tests: `src/pages/api/habits/[id]/*.integration.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unify POST /api/habits auth response

#### Automated

- [x] 1.1 Typecheck passes: npm run lint — 6239bce
- [x] 1.2 All existing tests pass: npm run test — 6239bce

#### Manual

- [x] 1.3 POST /api/habits without session returns 401 JSON — 6239bce

### Phase 2: Add unauthenticated test scenarios

#### Automated

- [x] 2.1 All tests pass: npm run test
- [x] 2.2 Typecheck passes: npm run lint

#### Manual

- [x] 2.3 All 5 unauthenticated describe blocks report green
- [x] 2.4 No Supabase query called in unauthenticated tests
