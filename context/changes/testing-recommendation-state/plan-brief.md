# Plan Brief: testing-recommendation-state

**Change:** Integration tests for recommendation accept/dismiss state consistency
**Phase count:** 1
**Files created:** 2

## What's being built

Integration tests for two existing endpoints that have no test coverage:

1. **POST `/api/habits/[id]/dismiss-recommendation`** — sets `recommendation_dismissed_at` timestamp
2. **PATCH `/api/habits/[id]`** (accept flow) — updates `frequency`, clears `recommendation_dismissed_at: null`

The `isSuppressed()` / "suppression reset on next completion" behavior is already tested in `src/lib/recommendation.test.ts` (scenarios 8–9). These tests cover the API layer only.

## Mock key map

| Endpoint | `"habits.maybeSingle"` | Update terminal |
|---|---|---|
| POST dismiss | ownership result | `"habits.then"` |
| PATCH accept | ownership result | `"habits.single"` |

## Key assertions per test type

- **Owner happy-path (both):** status 2xx + `client.eq("user_id", "owner-uuid")` (L-004) + `client.update` args verify state effect
- **PATCH state proof:** `client.update({ frequency: N, recommendation_dismissed_at: null })` — exact match
- **Dismiss state proof:** `client.update(expect.objectContaining({ recommendation_dismissed_at: expect.stringMatching(/^\d{4}-/) }))` — dynamic timestamp
- **Attacker:** 403, single `"error"` key, eq spy for attacker id
- **Unauth:** 401, `client.from` not called
- **Validation (PATCH):** 400 `"frequency must be an integer between 1 and 7"`, `client.from` not called
- **DB error:** 500, error message from mock

## Files

- `src/pages/api/habits/[id]/dismiss-recommendation.integration.test.ts` — 4 tests
- `src/pages/api/habits/[id]/index.integration.test.ts` — 6 tests
