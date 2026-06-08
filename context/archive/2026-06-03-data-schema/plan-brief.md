# Data Schema — Plan Brief

> Full plan: `context/changes/data-schema/plan.md`

## What & Why

HabitLoop has no custom database tables yet. This change creates the two foundation tables — `habits` and `completions` — with RLS policies and TypeScript types. Every user-facing slice (S-01 habit creation, S-02 completion logging, S-03 adaptive recommendation) depends on this schema landing correctly before any API routes can be written.

## Starting Point

Supabase Auth is fully configured and working. `supabase/migrations/` does not exist; `config.toml` has `schema_paths = []`. The Supabase client (`src/lib/supabase.ts`) is untyped — no `Database` generic. No custom tables exist.

## Desired End State

`npx supabase db reset` applies cleanly. `habits` and `completions` tables exist in the public schema with proper FK constraints, RLS (each user sees only their own rows), and a composite index on `completions(habit_id, completed_on DESC)` for rolling-window queries. `src/types/database.ts` is generated and the Supabase client uses `createServerClient<Database>()` — downstream slices get compile-time type safety for free.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Uniqueness on completions | UNIQUE (habit_id, completed_on) | Prevents duplicate log entries that would inflate the rolling-window count |
| user_id on completions | Denormalized (stored directly) | RLS policy is a single-table check; no JOIN to habits needed |
| Migration structure | Single file for both tables + RLS | Atomic apply; impossible to land habits without completions |
| RLS scope | auth.uid() = user_id, no explicit service_role policy | service_role bypasses RLS by default in Supabase — no extra SQL needed |
| TypeScript types | Generated into src/types/database.ts | All downstream slices get compile-time safety immediately |
| Soft delete | None | PRD Non-Goals explicitly excludes habit deletion in MVP |
| Index strategy | idx_completions_habit_date (habit_id, completed_on DESC) | Natural access path for the rolling-window query (FR-007) |

## Scope

**In scope:**
- `supabase/migrations/20260603000001_init_habits_completions.sql`
- RLS policies (SELECT/INSERT/UPDATE/DELETE) on both tables
- Composite index on `completions(habit_id, completed_on DESC)`
- `src/types/database.ts` — generated Supabase types
- `src/lib/supabase.ts` — add `Database` generic to `createServerClient`

**Out of scope:**
- Seed data / `seed.sql`
- Soft-delete columns
- Admin or service_role explicit policies
- Any API routes or UI (those belong to S-01+)

## Architecture / Approach

Single SQL migration creates `habits` (id, user_id→auth.users, name, frequency 1–7, created_at) and `completions` (id, habit_id→habits, user_id→auth.users, completed_on date, created_at) with the uniqueness constraint and RLS applied atomically. Phase 2 then generates TypeScript types from the live local schema and wires them into the SSR client factory.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Database Migration | SQL file creates both tables, RLS, index; `db reset` passes | RLS policy order bug (must ENABLE RLS before CREATE POLICY) |
| 2. TypeScript Types | `src/types/database.ts` generated; client typed | Gen command requires local Supabase running (`npx supabase start` first) |

**Prerequisites:** Local Supabase CLI installed; Docker running (for `npx supabase start`)
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- `frequency` stored as `smallint` — fits 1–7 cleanly; no risk of overflow, but confirms the "N×/week only" MVP constraint from PRD.
- `ON DELETE CASCADE` on both FK relationships — if a user's auth account is deleted, all their habits and completions are removed. This is the correct behavior given the privacy guardrail.

## Success Criteria (Summary)

- `npx supabase db reset` exits 0 and Studio shows both tables with 4 RLS policies each
- Cross-user query returns 0 rows (RLS enforced)
- `npm run lint` passes with `createServerClient<Database>` in place
