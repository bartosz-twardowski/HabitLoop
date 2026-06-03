---
change_id: habit-creation-dashboard
reviewer: superpowers:code-reviewer (subagent)
reviewed_at: 2026-06-03
base_sha: 17ff195
head_sha: f7d17b6
phases: all
---

# Implementation Review — habit-creation-dashboard

## Strengths

- **L-003 validation correctly applied.** `src/pages/api/habits/index.ts` uses `Number()` + `Number.isInteger()` (after review fix), which rejects floats (`"3.9"` → `3.9` → not integer), non-numeric strings, and out-of-range values. The plan's contract is matched exactly.
- **User identity sourced correctly.** The API route reads `context.locals.user` (set by middleware via `supabase.auth.getUser()`), not form body. The dashboard and detail page also use `Astro.locals.user`. No form body injection risk.
- **IDOR blocked at two layers in the detail page.** `src/pages/habits/[id].astro` includes `.eq("user_id", user.id)` (application-level scope) in addition to Supabase RLS.
- **`src/types/database.ts` not touched.** L-002 respected.
- **ESLint override correctly scoped.** The `@typescript-eslint/no-misused-promises` override lives inside the `astroConfig` block (`files: ["**/*.astro"]`), so the relaxation applies only to `.astro` files. `.tsx` and `.ts` files run under the stricter base config.
- **Signin redirect fixed surgically.** The diff to `signin.ts` is exactly one line: `/` replaced by `/dashboard`.

## Issues Found and Resolved

### Important

**I-1: `React.SubmitEvent` validity (dismissed)**
The reviewer flagged `React.SubmitEvent<HTMLFormElement>` as invalid. Assessed as moot for this codebase — React 19 ships `React.SubmitEvent<T>` and the existing `SignInForm.tsx` uses the same type. Passed type-checked lint. No change made.

**I-3: Dashboard query relied on RLS alone, no explicit `user_id` filter (fixed at f7d17b6)**
`src/pages/dashboard.astro` query had no `.eq("user_id", user.id)` clause, unlike the detail page which has both RLS and an application-level filter. Fixed: added `.eq("user_id", user.id)` for defense-in-depth parity.

### Minor

**M-2: `?error` param reflects arbitrary user-supplied strings**
`Astro.url.searchParams.get("error")` is rendered via JSX (`{message}`), which HTML-escapes the value — XSS is not a risk. Low-severity social-engineering vector only. Not fixed; acceptable for MVP.

**M-3: `parseInt` silently truncated decimals (fixed at f7d17b6)**
`parseInt("3.9", 10)` returned `3`, passing range validation silently. Fixed: changed to `Number(freqRaw)` so `"3.9"` fails `Number.isInteger()` and is explicitly rejected.

## Plan Alignment Summary

| Phase | Alignment | Notes |
|---|---|---|
| Phase 1: POST /api/habits | Full match | Validation logic, user identity, error redirects all match plan contract |
| Phase 2: HabitForm + new.astro | Match with cosmetic deviation | Missing `"use client"` directive is cosmetic in Astro context (no functional impact) |
| Phase 3: Dashboard list | Full match after fix | `.eq("user_id")` filter added post-review for defense-in-depth |
| Phase 4: Detail + route protection | Full match + improvement | Added explicit `!user` guard beyond plan's `!supabase \|\| !id` check |
| Phase 5: Signin redirect | Exact one-line fix | No other changes introduced |

## Overall Assessment

Clean, well-structured implementation. Architecture is consistent with established patterns (FormData POST, `context.locals.user`, SSR Supabase client, `@/` aliases). Security posture is correct for this slice. Two minor issues were fixed post-review; no critical issues found.
