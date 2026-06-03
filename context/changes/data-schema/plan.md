# Data Schema Implementation Plan

## Overview

Create the `habits` and `completions` Postgres tables in Supabase with full Row-Level Security (RLS), a composite index tuned for rolling-window queries, and generated TypeScript database types wired into the Supabase client. This is foundation change F-01 — no user-facing slice can start without it.

## Current State Analysis

- No custom migrations exist. `supabase/config.toml:55` has `schema_paths = []`; the `supabase/migrations/` directory does not exist.
- Only Supabase Auth's built-in `auth.users` table is present — no custom tables.
- `src/lib/supabase.ts` constructs an untyped `createServerClient(...)` (no `Database` generic).
- `src/env.d.ts` declares only `App.Locals.user` — no database type definitions.
- `seed.sql` is referenced in config but does not exist; no seed data is needed for this change.

## Desired End State

- `supabase/migrations/<timestamp>_init_habits_completions.sql` exists and applies cleanly via `npx supabase db reset`.
- `habits` and `completions` tables are present in the public schema with correct constraints, FK relationships, and RLS enabled.
- Each user sees only their own rows on both tables under any auth.uid()-based query.
- `src/types/database.ts` contains the generated Supabase types.
- `src/lib/supabase.ts` passes `Database` as the type generic — `createServerClient<Database>(...)`.
- `npm run lint` passes with no TypeScript errors.

### Key Discoveries

- `src/lib/supabase.ts:6` — `createServerClient` is called without a type parameter; this is the only change needed in that file.
- `supabase/config.toml:53-58` — migrations are enabled; creating `supabase/migrations/` and placing a `.sql` file there is all Supabase CLI needs to pick it up on `db reset`.
- No `src/types/` directory exists yet — create it as part of Phase 2.
- Auth is fully wired (`src/middleware.ts`, `src/pages/api/auth/`); `auth.users` is the FK target for both tables.

## What We're NOT Doing

- No seed data — no `supabase/seed.sql` is created.
- No soft-delete columns — PRD explicitly excludes habit deletion in MVP.
- No service_role bypass policies — Supabase service_role bypasses RLS by default; no extra SQL needed.
- No multi-schema setup — public schema only.
- No admin or shared-access roles — flat user model per PRD.

## Implementation Approach

Two sequential phases: (1) write and apply the SQL migration, (2) generate TypeScript types and wire them into the client. Phase 1 must complete and pass `db reset` before Phase 2 can run, because type generation reads the live local schema.

## Critical Implementation Details

**Type generation requires a running local instance.** `npx supabase gen types typescript --local` connects to the local Supabase Postgres. The implementer must run `npx supabase start` before executing the gen command in Phase 2 — if the instance is not running, the command fails silently or errors out.

**RLS must be enabled before policies are created.** The migration must call `ALTER TABLE … ENABLE ROW LEVEL SECURITY` before `CREATE POLICY` statements, or the policies are unreachable. The migration template below follows this order.

---

## Phase 1: Database Migration

### Overview

Create `supabase/migrations/` and a single timestamped SQL file that defines both tables, FK constraints, uniqueness constraint, RLS, and the composite index — all atomically in one apply.

### Changes Required

#### 1. Migration directory

**File**: `supabase/migrations/` (new directory)

**Intent**: Supabase CLI auto-discovers migrations from this path. Creating the directory is enough — no config change to `config.toml` is needed.

**Contract**: Directory must exist at `supabase/migrations/` relative to project root.

#### 2. Migration SQL file

**File**: `supabase/migrations/20260603000001_init_habits_completions.sql`

**Intent**: Define the complete public schema for HabitLoop MVP — both tables, all constraints, RLS policies, and the rolling-window index.

**Contract**: The file must produce the following schema when applied to an empty public schema:

```sql
-- habits
CREATE TABLE habits (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  frequency  smallint    NOT NULL CHECK (frequency >= 1 AND frequency <= 7),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- completions
CREATE TABLE completions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id     uuid        NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_on date        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT completions_habit_date_unique UNIQUE (habit_id, completed_on)
);

-- Composite index for rolling-window queries (FR-007)
CREATE INDEX idx_completions_habit_date ON completions(habit_id, completed_on DESC);

-- RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- habits policies
CREATE POLICY "habits_select_own"  ON habits FOR SELECT USING        (user_id = auth.uid());
CREATE POLICY "habits_insert_own"  ON habits FOR INSERT WITH CHECK   (user_id = auth.uid());
CREATE POLICY "habits_update_own"  ON habits FOR UPDATE USING        (user_id = auth.uid())
                                              WITH CHECK              (user_id = auth.uid());
CREATE POLICY "habits_delete_own"  ON habits FOR DELETE USING        (user_id = auth.uid());

-- completions policies
CREATE POLICY "completions_select_own" ON completions FOR SELECT USING        (user_id = auth.uid());
CREATE POLICY "completions_insert_own" ON completions FOR INSERT WITH CHECK   (user_id = auth.uid());
CREATE POLICY "completions_update_own" ON completions FOR UPDATE USING        (user_id = auth.uid())
                                                       WITH CHECK              (user_id = auth.uid());
CREATE POLICY "completions_delete_own" ON completions FOR DELETE USING        (user_id = auth.uid());
```

The snippet is canonical — copy it directly. Do not paraphrase the RLS policy names; downstream tooling and Supabase Studio display them verbatim.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset` exits 0 with no errors
- Tables exist: `npx supabase db diff` shows no pending changes after reset
- Linting passes: `npm run lint`

#### Manual Verification

- Open Supabase Studio at `http://localhost:54323` → Table Editor → confirm `habits` and `completions` tables are present
- In Studio → Authentication → Policies → confirm both tables show 4 RLS policies each
- Confirm the `idx_completions_habit_date` index appears under `completions` in the Studio schema view

**Implementation Note**: After all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: TypeScript Types

### Overview

Generate Supabase TypeScript types from the live local schema and wire the `Database` type into the Supabase client factory. This gives all downstream API routes (S-01, S-02, S-03) compile-time type safety against the actual schema.

### Changes Required

#### 1. Generated types file

**File**: `src/types/database.ts` (new file, generated — do not hand-write)

**Intent**: Provide the `Database` TypeScript type that describes the full Supabase schema so the client and query results are statically typed.

**Contract**: Generated by running the following command with the local Supabase instance running:

```
npx supabase gen types typescript --local > src/types/database.ts
```

The output file exports a `Database` type at the top level. Do not edit this file manually — it is regenerated whenever the schema changes.

#### 2. Typed Supabase client

**File**: `src/lib/supabase.ts`

**Intent**: Pass the `Database` type generic to `createServerClient` so all query results infer the correct table types.

**Contract**: Import `Database` from `@/types/database` and update the `createServerClient` call signature:

```typescript
import type { Database } from "@/types/database";
// ...
return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { ... });
```

No other changes to this file.

### Success Criteria

#### Automated Verification

- Type check passes: `npm run lint` (includes `astro check` which runs tsc)
- `src/types/database.ts` exists and is non-empty: `test -s src/types/database.ts`

#### Manual Verification

- In VS Code (or editor with TypeScript), open `src/lib/supabase.ts` and confirm the return type of `createClient` resolves to `SupabaseClient<Database>` with no red squiggles
- Hover over a `supabase.from('habits')` call (can be in a scratch file or test) and confirm autocomplete shows `habits` and `completions` as valid table names

**Implementation Note**: After all automated verification passes, pause here for manual confirmation before closing out the change.

---

## Testing Strategy

### Manual Testing Steps

1. `npx supabase start` — start local instance
2. `npx supabase db reset` — apply migration from scratch; confirm exit 0
3. Open Studio at `http://localhost:54323` → verify table structure, RLS policies, and index
4. Sign up a test user via the app's `/auth/signup` route
5. Insert a habit row via Studio SQL editor as that user (using the anon key) — confirm RLS allows the insert
6. Attempt to query another user's habits — confirm 0 rows returned (RLS blocks cross-user access)
7. Insert two completions with the same `habit_id` + `completed_on` — confirm the unique constraint rejects the second insert

## Migration Notes

This is the first migration in the project. If the schema needs changes after this lands, create a new migration file (`20260603000002_...`) rather than editing the original — Supabase applies migrations incrementally.

To regenerate types after a future schema change: `npx supabase gen types typescript --local > src/types/database.ts`.

## References

- PRD: `context/foundation/prd.md` — FR-004, FR-005, FR-007, Guardrail
- Roadmap: `context/foundation/roadmap.md` — F-01
- Supabase client: `src/lib/supabase.ts`
- Supabase config: `supabase/config.toml:53-58`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Migration

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` exits 0
- [x] 1.2 No pending diff: `npx supabase db diff` shows no changes after reset
- [x] 1.3 Linting passes: `npm run lint`

#### Manual

- [x] 1.4 habits and completions tables visible in Supabase Studio Table Editor
- [x] 1.5 Both tables show 4 RLS policies each in Studio → Authentication → Policies
- [x] 1.6 `idx_completions_habit_date` index visible on completions in Studio schema view

### Phase 2: TypeScript Types

#### Automated

- [ ] 2.1 Type check passes: `npm run lint`
- [ ] 2.2 Types file exists and is non-empty: `test -s src/types/database.ts`

#### Manual

- [ ] 2.3 `createClient` return type resolves to `SupabaseClient<Database>` in editor
- [ ] 2.4 `supabase.from('habits')` autocomplete shows habits and completions as valid table names
