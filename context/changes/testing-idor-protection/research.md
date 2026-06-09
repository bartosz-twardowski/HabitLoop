---
date: 2026-06-08T14:00:00+02:00
researcher: Claude
git_commit: e38ab5f
branch: main
repository: _10xDEVS
topic: "IDOR protection: where ownership is enforced, what proves protection, cheapest integration test approach"
tags: [research, codebase, idor, api-ownership, integration-tests]
status: complete
last_updated: 2026-06-08
last_updated_by: Claude
---

# Research: IDOR Protection — API Ownership Enforcement

**Date**: 2026-06-08T14:00:00+02:00
**Researcher**: Claude
**Git Commit**: e38ab5f
**Branch**: main
**Repository**: _10xDEVS

## Research Question

For test-plan Risk #2 (User A reads or writes User B's habits/completions — IDOR): where does the risk pass through code, what behavior proves protection, and what is the cheapest test that catches it?

## Summary

The codebase has **dual-layer IDOR defense**: RLS policies at the database level and explicit ownership checks in every API handler that accepts a habit/completion ID. L-001 (completions INSERT gap) has been fixed via migration. No IDOR gaps were found — but that's exactly what integration tests should prove and protect against regression.

The cheapest honest test approach: **import handler functions directly, mock the Supabase client, set two different `context.locals.user` identities, assert User A gets 200 and User B gets 403.** This tests the actual ownership check logic without needing Docker/local Supabase.

## Detailed Findings

### 1. Where the Risk Passes Through Code

Four API endpoints accept a habit ID parameter. Each has an ownership check:

| Endpoint | File | Method | Ownership Check | Lines |
|----------|------|--------|-----------------|-------|
| `/api/habits/[id]` | `src/pages/api/habits/[id]/index.ts` | PATCH | Explicit: `.eq("user_id", user.id).maybeSingle()` | 33-38 |
| `/api/habits/[id]/completions` | `src/pages/api/habits/[id]/completions/index.ts` | POST | Explicit: same pattern | 33-38 |
| `/api/habits/[id]/completions/[date]` | `src/pages/api/habits/[id]/completions/[date].ts` | DELETE | Implicit: `.eq("user_id", user.id)` in delete query | 29-34 |
| `/api/habits/[id]/dismiss-recommendation` | `src/pages/api/habits/[id]/dismiss-recommendation.ts` | POST | Explicit: same pattern | 20-25 |

**Shared pattern** (3 of 4 endpoints):
```typescript
const { data: habit } = await supabase
  .from("habits").select("id")
  .eq("id", id).eq("user_id", user.id)
  .maybeSingle();
if (!habit) {
  return Response.json({ error: "Habit not found" }, { status: 403 });
}
```

The DELETE completion endpoint is different — it combines ownership and deletion into one query, returning 403 when `count === 0`.

Additionally, `POST /api/habits` (create) does NOT need an ownership check — it creates a habit assigned to the authenticated user. No habit ID is accepted as input.

### 2. What Behavior Proves Protection

For each endpoint, the test must prove:

- **User A** (owner of habit X) sends request with habit X's ID → gets success response (200/201)
- **User B** (different user, NOT owner of habit X) sends the same request with habit X's ID → gets **403** with `"Habit not found"` or `"Completion not found"`

The 403 response must NOT leak whether the habit exists — the message is deliberately ambiguous ("not found" vs "not yours"). This is already implemented consistently.

**Critical behavioral assertion**: User B MUST NOT receive any data from User A's habit. The test should also verify that User B's 403 response body contains no habit data (not just the status code).

### 3. Cheapest Test That Catches This Risk

**Approach: Direct handler invocation with mocked Supabase client.**

Why this is cheapest:
- No running Astro server needed (handlers are plain async functions)
- No Docker / local Supabase needed
- No test user seeding
- Runs in < 1 second alongside existing unit tests

**Key technical details:**

1. **Handler signature**: `APIRoute = (context: APIContext) => Response | Promise<Response>`. Can be imported and called directly.

2. **`astro:env/server` blocker**: `src/lib/supabase.ts` imports from the Astro virtual module `astro:env/server`. This doesn't exist outside the Astro runtime. Solution: add a Vitest alias in `vitest.config.ts` that maps `astro:env/server` to a stub module exporting test env vars — OR mock `@/lib/supabase` entirely via `vi.mock`.

3. **Context construction**: Build a minimal `APIContext`-shaped object with:
   - `locals.user`: `{ id: "user-a-uuid" }` for owner, `{ id: "user-b-uuid" }` for attacker
   - `params`: `{ id: "habit-uuid" }` (and `{ date: "2026-06-01" }` for completion delete)
   - `request`: `new Request(url, { method, body })` (standard Web API)
   - `cookies`: minimal stub with `getAll()` returning `[]`
   - `redirect()`: `(path: string, status = 302) => new Response(null, { status, headers: { Location: path } })`

4. **Supabase mock strategy**: Mock `createClient` from `@/lib/supabase` to return a chainable object that simulates Supabase query builder:
   - For owner queries: `.maybeSingle()` returns `{ data: { id: "habit-uuid" }, error: null }`
   - For non-owner queries: `.maybeSingle()` returns `{ data: null, error: null }`
   - The mock must be configurable per-test to switch between "owner" and "non-owner" responses

5. **What this tests vs. what it doesn't**:
   - **Tests**: the handler's ownership check logic, response codes, response bodies, the `user_id` equality check
   - **Does NOT test**: RLS policies at the database level (would need a real Supabase instance)
   - This is acceptable because RLS is defense-in-depth; the API handler check is the primary gate tested here. RLS testing would be a separate concern.

## Code References

- `src/pages/api/habits/[id]/index.ts:33-38` — PATCH ownership check
- `src/pages/api/habits/[id]/completions/index.ts:33-38` — POST completion ownership check
- `src/pages/api/habits/[id]/completions/[date].ts:29-34` — DELETE completion implicit ownership
- `src/pages/api/habits/[id]/dismiss-recommendation.ts:20-25` — dismiss ownership check
- `src/pages/api/habits/index.ts:5-38` — POST create (no ID param, no ownership check needed)
- `src/lib/supabase.ts:1-25` — client factory using `astro:env/server` virtual module
- `src/middleware.ts:6-16` — auth middleware setting `context.locals.user`
- `src/env.d.ts:1-5` — `App.Locals.user` type definition
- `vitest.config.ts:1-13` — existing test config with `@/` alias
- `supabase/migrations/20260605000001_completions_insert_ownership.sql` — L-001 fix
- `supabase/migrations/20260608000001_drop_completions_update_policy.sql` — UPDATE policy removal

## Architecture Insights

1. **Dual-layer defense**: Every mutation endpoint has BOTH an RLS policy (DB-level) AND an explicit handler-level ownership check. The integration test targets the handler layer.

2. **Consistent 403 pattern**: All endpoints return 403 with an ambiguous "not found" message — this prevents information disclosure (attacker can't distinguish "habit doesn't exist" from "habit exists but isn't yours").

3. **DELETE uses implicit ownership**: The completion DELETE endpoint doesn't do a separate ownership SELECT — it includes `user_id` in the DELETE WHERE clause and checks `count === 0`. Functionally equivalent but different test setup needed (mock the delete response, not a select).

4. **`astro:env/server` is the integration test blocker**: Every handler indirectly depends on this virtual module via `createClient`. Either alias it in vitest config or mock the entire `@/lib/supabase` module. Mocking `@/lib/supabase` is simpler and avoids coupling tests to Astro internals.

5. **Auth is NOT mocked**: Setting `context.locals.user` directly is what the middleware produces. The test trusts middleware (tested separately in Risk #3 scope) and focuses on what the handler does with the user identity.

## Historical Context (from prior changes)

- `context/changes/testing-unit-bootstrap/plan.md` — Phase 1 unit test bootstrap complete. Established Vitest + `@/` alias. Explicitly deferred integration tests to Phase 2.
- `context/archive/2026-06-05-data-schema/plan.md` — Applied L-001 fix (completions INSERT ownership migration). Dropped completions UPDATE policy.
- `context/archive/2026-06-04-completion-logging-history/plan.md` — Original completion endpoints with ownership checks per L-001.

## Open Questions

1. **Should the test mock `@/lib/supabase` entirely or alias `astro:env/server`?** Mocking `@/lib/supabase` is lighter but means the test doesn't exercise `createClient` itself. Aliasing `astro:env/server` is heavier but exercises more of the real code path. Recommendation: mock `@/lib/supabase` for IDOR tests (handler logic is the focus, not client creation).

2. **How to build a reusable Supabase mock?** The chainable query builder pattern (`.from().select().eq().eq().maybeSingle()`) needs a fluent mock. A small `createMockSupabaseClient(config)` helper factory would serve all 4 endpoint tests and future integration tests.

3. **Should the `AstroCookies` stub be shared?** Yes — a minimal `{ getAll: () => [], get: () => undefined, set: () => {} }` stub works for all handlers. This should live in a test helper module.
