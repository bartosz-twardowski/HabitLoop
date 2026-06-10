# Fix Lint Errors — Implementation Plan

## Overview

Fix 60 pre-existing ESLint errors blocking the `testing-ci-gates` change. The root cause is
`src/types/database.ts` containing an empty schema (`Tables: { [_ in never]: never }`) — Supabase
queries resolve to `never`, cascading into `no-unnecessary-condition` and `no-unsafe-*` errors
across API routes and Astro pages. Fix by regenerating `database.ts` from the live local schema,
then running `npm run lint:fix` for CRLF and other auto-fixable issues.

## Current State Analysis

**Root cause**: `src/types/database.ts` has `public.Tables: { [_ in never]: never }` — no table
definitions. This means:
- `supabase.from("habits").select("id").maybeSingle()` resolves `data` to `never`
- `if (!habit)` where `habit: never` → TypeScript evaluates this as always-true → `no-unnecessary-condition`
- Query results typed as `never` cascade to `any`/error in Astro templates → `no-unsafe-*`

**Error breakdown** (60 total, 6 files):

| File | Errors | Type |
|------|--------|------|
| `src/pages/api/habits/index.ts` | 38 | CRLF line endings (`prettier/prettier`) |
| `src/pages/api/habits/[id]/completions/index.ts` | 1 | `no-unnecessary-condition` on `if (!habit)` |
| `src/pages/api/habits/[id]/dismiss-recommendation.ts` | 1 | `no-unnecessary-condition` on `if (!habit)` |
| `src/pages/api/habits/[id]/index.ts` | 1 | `no-unnecessary-condition` on `if (!habit)` |
| `src/pages/dashboard.astro` | 11 | `no-unsafe-*` cascade from `Object.groupBy` + query results |
| `src/pages/habits/[id]/log.astro` | 8 | `no-unnecessary-condition` + `no-unsafe-*` cascade |

**Note**: `src/types/database.ts` is generated — never hand-edit per L-002. Regenerate only via
`npx supabase gen types typescript --local > src/types/database.ts` with local instance running.

## Desired End State

`npm run lint` exits 0 with 0 errors. `src/types/database.ts` contains proper Row/Insert/Update
type definitions for `habits` and `completions` tables, enabling accurate TypeScript inference
throughout the codebase.

### Key Discoveries

- `src/types/database.ts:9-51` — `public.Tables` and `graphql_public.Tables` both resolve to
  `{ [_ in never]: never }` — the file was generated against an empty or unstarted local instance
- `src/lib/supabase.ts:10` — `createServerClient<Database>(...)` is correctly typed; once
  `Database` has real table definitions, all downstream types resolve automatically
- `src/pages/api/habits/index.ts` — CRLF line endings; unrelated to the type issue; fixable by
  `npm run lint:fix`

## What We're NOT Doing

- Hand-editing `src/types/database.ts` — regenerate only, per L-002
- Adding eslint-disable comments — regeneration should make all suppression unnecessary
- Changing any business logic in API routes or Astro pages
- Fixing any other pre-existing issues not in the 60-error list

## Implementation Approach

Two phases:

1. **Regenerate + auto-fix**: Start local Supabase, regenerate `database.ts`, stop Supabase, run
   `npm run lint:fix` for CRLF, verify with `npm run lint`.
2. **Residual fixes** (if Phase 1 doesn't reach 0): For any remaining errors, apply targeted
   `eslint-disable-next-line` suppress comments or explicit type annotations.

---

## Phase 1: Regenerate database.ts and auto-fix

### Overview

Start the local Supabase instance, regenerate `src/types/database.ts` from the actual schema,
stop the instance, run `npm run lint:fix` for CRLF errors, then verify lint is clean.

### Changes Required

#### 1. Start local Supabase

**File**: (no file change — command only)

**Intent**: Start the local Postgres + Auth instance so `supabase gen types` can introspect the
actual schema.

**Contract**: `npx supabase start` must exit without error. If Docker is not running or RAM is
insufficient (requires ≥7 GB free), stop and resolve before continuing.

#### 2. Regenerate src/types/database.ts

**File**: `src/types/database.ts`

**Intent**: Overwrite the empty generated types file with the real schema so TypeScript can infer
correct Row/Insert/Update types for `habits` and `completions`.

**Contract**: Run `npx supabase gen types typescript --local > src/types/database.ts`. The output
file must contain `habits` and `completions` entries under `public.Tables`. Do NOT edit the file
manually per L-002 — the `>` redirect is the only write mechanism.

#### 3. Stop local Supabase

**File**: (no file change — command only)

**Intent**: Stop the local instance after type generation to free resources.

**Contract**: `npx supabase stop` exits cleanly.

#### 4. Auto-fix CRLF and other fixable issues

**File**: `src/pages/api/habits/index.ts` (and any others `lint:fix` touches)

**Intent**: Run `npm run lint:fix` to automatically repair the 38 CRLF line-ending errors in
`habits/index.ts` and any other auto-fixable violations.

**Contract**: `npm run lint:fix` exits without error. Only `src/pages/api/habits/index.ts` is
expected to be modified by this step.

**Actual outcome (impl-review note)**: `src/pages/api/habits/index.ts` did not appear in the
committed diff. The file is LF-clean in the working tree — git's `autocrlf` normalization
resolved the CRLF endings at stage time, so git saw no delta. Practical result is correct
(lint exits 0, file is clean); the mechanism was git normalization, not a committed file edit.

### Success Criteria

#### Automated Verification

- `npm run lint` exits 0 with 0 errors and 0 warnings
- `npm run test` still exits 0 with 91 tests passing (no regression)

#### Manual Verification

- `src/types/database.ts` visually inspected: contains `habits` and `completions` table
  definitions under `public.Tables` (not `{ [_ in never]: never }`)

---

## Phase 2: Residual manual fixes (conditional)

### Overview

If `npm run lint` after Phase 1 still reports errors (e.g., errors that weren't caused by the
empty database.ts), apply targeted suppressions or type annotations to reach 0.

### Changes Required

#### 1. Assess remaining errors

**File**: (no file change — assessment only)

**Intent**: Run `npm run lint` and categorize any remaining errors by rule and file. Only proceed
with fixes if errors remain after Phase 1.

**Contract**: If 0 errors remain, this phase is a no-op and can be skipped. Document any
remaining errors before fixing.

#### 2. Apply targeted fixes

**File**: whichever files still have errors after Phase 1

**Intent**: For each remaining error, apply the minimal fix: `eslint-disable-next-line` for
genuine false positives (e.g., `no-unnecessary-condition` on a guard that TypeScript still can't
narrow), or a type annotation for `no-unsafe-*` that doesn't resolve via the regenerated types.

**Contract**: Each suppress comment must be on the line immediately above the flagged statement.
Each type annotation must be explicit (no `as any`). After applying all fixes, `npm run lint`
exits 0.

### Success Criteria

#### Automated Verification

- `npm run lint` exits 0 with 0 errors
- `npm run test` exits 0 with 91 tests passing

#### Manual Verification

- No `as any` casts introduced — type annotations use real types or explicit interfaces
- Each `eslint-disable` comment has a trailing inline comment explaining why the suppress is valid

---

## References

- Lessons: `context/foundation/lessons.md` — L-002 (database.ts is generated, never hand-edit)
- Generated types: `src/types/database.ts`
- Supabase client: `src/lib/supabase.ts`
- ESLint config: `eslint.config.mjs` (if present)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Regenerate database.ts and auto-fix

#### Automated

- [x] 1.1 npm run lint exits 0 with 0 errors — e8ef1ec
- [x] 1.2 npm run test exits 0 with 91 tests passing — e8ef1ec

#### Manual

- [x] 1.3 database.ts visually confirmed: habits and completions tables present under public.Tables — e8ef1ec

### Phase 2: Residual manual fixes (conditional)

#### Automated

- [x] 2.1 npm run lint exits 0 with 0 errors
- [x] 2.2 npm run test exits 0 with 91 tests passing

#### Manual

- [x] 2.3 No as any casts introduced; each eslint-disable has explanatory inline comment
