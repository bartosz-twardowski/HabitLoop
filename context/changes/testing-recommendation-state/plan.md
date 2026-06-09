---
change_id: testing-recommendation-state
title: Integration tests for recommendation accept/dismiss state consistency
status: planned
created: 2026-06-09
updated: 2026-06-09
---

## Overview

Add integration tests for the two recommendation lifecycle endpoints:

- **POST `/api/habits/[id]/dismiss-recommendation`** — sets `recommendation_dismissed_at` timestamp
- **PATCH `/api/habits/[id]`** — updates `frequency` and clears `recommendation_dismissed_at: null` (accept flow)

The "suppression reset on next completion" behavior is already fully unit-tested in `src/lib/recommendation.test.ts` (scenarios 8 & 9 of `computeRecommendation`). These integration tests cover the API-layer state effects only.

## Current State

- `src/lib/recommendation.ts` — `isSuppressed()` and `computeRecommendation()` fully tested in `src/lib/recommendation.test.ts`
- `src/pages/api/habits/[id]/dismiss-recommendation.ts` — no integration tests
- `src/pages/api/habits/[id]/index.ts` (PATCH handler) — no integration tests
- Mock infrastructure: `src/test-utils/api-helpers.ts` — `createMockSupabaseClient`, `createMockContext`, `setupSupabaseMock` ready to use

## What We're NOT Doing

- Not re-testing `isSuppressed()` or `computeRecommendation()` — already covered in `recommendation.test.ts`
- Not adding tests for GET habits or other unrelated PATCH scenarios
- Not creating new mock utilities — existing infrastructure is sufficient

---

## Phase 1: Dismiss-recommendation and accept-recommendation integration tests

### Overview

Create two new integration test files — one per endpoint — covering ownership, auth,
state-consistency assertions, and DB error paths.

**Mock keys used:**

| Endpoint | Ownership check terminal | Update terminal |
|---|---|---|
| POST dismiss | `"habits.maybeSingle"` | `"habits.then"` (update awaited directly) |
| PATCH accept | `"habits.maybeSingle"` | `"habits.single"` (update chained with `.select().single()`) |

### Changes Required

**Create** `src/pages/api/habits/[id]/dismiss-recommendation.integration.test.ts`

Suites and test cases:

1. **`describe("POST /api/habits/[id]/dismiss-recommendation — ownership enforcement")`**
   - `"owner receives 200 with ok: true and update is stamped with a dismissed_at ISO timestamp"`
     - Mock: `"habits.maybeSingle"` → `{ data: { id: "habit-1" }, error: null }`, `"habits.then"` → `{ data: null, error: null }`
     - Params: `{ id: "habit-1" }`, user: `{ id: "owner-uuid" }`, method: `"POST"`
     - Assert: `response.status === 200`, body `{ ok: true }`
     - Assert (L-004): `expect(client.eq).toHaveBeenCalledWith("user_id", "owner-uuid")`
     - Assert (state): `expect(client.update).toHaveBeenCalledWith(expect.objectContaining({ recommendation_dismissed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) }))`
   - `"attacker receives 403 with no update performed"`
     - Mock: `"habits.maybeSingle"` → `{ data: null, error: null }`
     - Assert: `response.status === 403`, body `{ error: "Habit not found" }`, only key is `"error"`
     - Assert: `expect(client.eq).toHaveBeenCalledWith("user_id", "attacker-uuid")`

2. **`describe("POST /api/habits/[id]/dismiss-recommendation — unauthenticated")`**
   - `"returns 401 when user is not logged in"`
     - User: `null`
     - Assert: `response.status === 401`, body `{ error: "Unauthorized" }`
     - Assert: `expect(client.from).not.toHaveBeenCalled()`

3. **`describe("POST /api/habits/[id]/dismiss-recommendation — DB error")`**
   - `"returns 500 when database returns an error on update"`
     - Mock: `"habits.maybeSingle"` → `{ data: { id: "habit-1" }, error: null }`, `"habits.then"` → `{ data: null, error: { message: "DB error" } }`
     - Assert: `response.status === 500`, body `{ error: "DB error" }`

---

**Create** `src/pages/api/habits/[id]/index.integration.test.ts`

Suites and test cases:

1. **`describe("PATCH /api/habits/[id] — accept recommendation (ownership enforcement)")`**
   - `"owner receives 200 with frequency updated and recommendation_dismissed_at cleared to null"`
     - Mock: `"habits.maybeSingle"` → `{ data: { id: "habit-1" }, error: null }`, `"habits.single"` → `{ data: { id: "habit-1", frequency: 3 }, error: null }`
     - Body: `{ frequency: 3 }`, user: `{ id: "owner-uuid" }`
     - Assert: `response.status === 200`, body `{ id: "habit-1", frequency: 3 }`
     - Assert (L-004): `expect(client.eq).toHaveBeenCalledWith("user_id", "owner-uuid")`
     - Assert (state): `expect(client.update).toHaveBeenCalledWith({ frequency: 3, recommendation_dismissed_at: null })`
   - `"attacker receives 403 with no update performed"`
     - Mock: `"habits.maybeSingle"` → `{ data: null, error: null }`
     - Body: `{ frequency: 3 }`, user: `{ id: "attacker-uuid" }`
     - Assert: `response.status === 403`, body `{ error: "Habit not found" }`, only key is `"error"`
     - Assert: `expect(client.eq).toHaveBeenCalledWith("user_id", "attacker-uuid")`

2. **`describe("PATCH /api/habits/[id] — unauthenticated")`**
   - `"returns 401 when user is not logged in"`
     - User: `null`, body: `{ frequency: 3 }`
     - Assert: `response.status === 401`, body `{ error: "Unauthorized" }`
     - Assert: `expect(client.from).not.toHaveBeenCalled()`

3. **`describe("PATCH /api/habits/[id] — frequency validation")`**
   - `"returns 400 when frequency is missing from request body"`
     - Body: `{}`, user: `{ id: "owner-uuid" }`
     - Assert: `response.status === 400`, body `{ error: "frequency must be an integer between 1 and 7" }`
     - Assert: `expect(client.from).not.toHaveBeenCalled()`
   - `"returns 400 when frequency is out of range (8)"`
     - Body: `{ frequency: 8 }`, user: `{ id: "owner-uuid" }`
     - Assert: `response.status === 400`, body `{ error: "frequency must be an integer between 1 and 7" }`
     - Assert: `expect(client.from).not.toHaveBeenCalled()`

4. **`describe("PATCH /api/habits/[id] — DB error")`**
   - `"returns 500 when database returns an error on update"`
     - Mock: `"habits.maybeSingle"` → `{ data: { id: "habit-1" }, error: null }`, `"habits.single"` → `{ data: null, error: { message: "DB error" } }`
     - Body: `{ frequency: 3 }`, user: `{ id: "owner-uuid" }`
     - Assert: `response.status === 500`, body `{ error: "DB error" }`

### Success Criteria

#### Automated

- [ ] `npx vitest run src/pages/api/habits/\\[id\\]/dismiss-recommendation.integration.test.ts` — all tests pass
- [ ] `npx vitest run src/pages/api/habits/\\[id\\]/index.integration.test.ts` — all tests pass
- [ ] `npm run lint` — no new lint errors introduced

#### Manual

- [ ] Confirm test file structure matches existing `.integration.test.ts` conventions (vi.mock at top, vi.resetModules + vi.clearAllMocks in beforeEach, dynamic import inside each test)

---

## Progress

### Phase 1: Dismiss-recommendation and accept-recommendation integration tests

#### Automated
- [x] 1.1 Create dismiss-recommendation.integration.test.ts
- [x] 1.2 Create index.integration.test.ts (PATCH)
- [x] 1.3 Run vitest for dismiss test file — all pass
- [x] 1.4 Run vitest for index test file — all pass
- [x] 1.5 Run lint — no new errors

#### Manual
- [x] 1.6 Confirm test file structure matches existing integration test conventions
