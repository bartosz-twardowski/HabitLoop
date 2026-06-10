# Fix Lint Errors — Plan Brief

> Full plan: `context/changes/fix-lint-errors/plan.md`

## What & Why

Fix 60 pre-existing ESLint errors so that `npm run lint` passes and the `testing-ci-gates` CI
change can be completed. The errors block the CI gate because the workflow runs lint as a required
step.

## Starting Point

`src/types/database.ts` was generated against an empty or unstarted local Supabase instance and
contains `public.Tables: { [_ in never]: never }` — no table definitions. This causes all
Supabase query results to resolve to `never`, triggering `no-unnecessary-condition` and
`no-unsafe-*` lint errors across 5 files. An unrelated `habits/index.ts` has 38 CRLF errors.

## Desired End State

`npm run lint` exits 0. `database.ts` has real `habits` and `completions` table definitions.
`testing-ci-gates` can proceed to commit.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|------------------|
| Fix strategy | Regenerate database.ts | Root cause fix — one command eliminates all type-cascade errors; suppression leaves types broken |
| CRLF fix | `npm run lint:fix` | Auto-fixable; no manual intervention needed |
| Residual errors | Phase 2 conditional | If regen doesn't clear everything, targeted suppress/annotations as fallback |
| database.ts edit method | `npx supabase gen types --local >` redirect only | L-002: never hand-edit the generated file |

## Scope

**In scope:**
- Regenerate `src/types/database.ts` via local Supabase
- Auto-fix CRLF via `npm run lint:fix`
- Any residual errors not fixed by regen (Phase 2, conditional)

**Out of scope:**
- Business logic changes in API routes or Astro pages
- New tests
- ESLint config changes

## Architecture / Approach

The fix flows through the generation toolchain rather than the source files: start Docker/Supabase
→ regenerate types → stop → lint:fix → verify. No production code changes expected.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Regenerate + auto-fix | database.ts with real types; 0 CRLF errors | Docker not running / insufficient RAM |
| 2. Residual fixes (conditional) | Any remaining errors cleared | Errors unrelated to database.ts may need manual investigation |

**Prerequisites:** Docker running, ≥7 GB RAM free.  
**Estimated effort:** ~1 session; Phase 2 may not be needed.

## Open Risks & Assumptions

- If the local Supabase schema doesn't match what production expects, regenerated types may differ
  from cloud — acceptable for MVP, verify manually.
- Phase 2 may be a no-op if all 60 errors cascade from the empty database.ts (likely).

## Success Criteria (Summary)

- `npm run lint` exits 0 with 0 errors
- `npm run test` still 91/91 passing
- `database.ts` contains real table definitions
