# Adaptive Recommendation — Plan Brief

> Full plan: `context/changes/adaptive-recommendation/plan.md`

## What & Why

S-03 is the product's north-star slice: the adaptive rule that automatically adjusts habit goals based on real completion data. Without it HabitLoop is just a habit logger — identical to every other tracker. This implementation adds server-side recommendation computation (lower/raise/maintain) to the dashboard and lets users accept or dismiss each recommendation inline.

## Starting Point

The habits and completions tables are fully operational with the rolling-window index in place (`idx_completions_habit_date` on `(habit_id, completed_on DESC)`). The dashboard currently fetches habits only and renders a static Astro list with no React interactivity. No recommendation logic exists in the codebase.

## Desired End State

Every habit card on `/dashboard` shows a recommendation badge computed from the user's last 3 completed calendar weeks. Users click Accept (frequency adjusts ±1) or Dismiss (recommendation hides until new completions arrive). Habits with fewer than 2 weeks of data show a "First recommendation in N days" countdown. The entire rule fires on every page load with no user action required.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Rolling window size | 3 completed calendar weeks | Longer window → more reliable signal, user waited for 3-week PRD range | Plan |
| Run-length threshold | 1 week (most recent week decides) | Fast feedback loop; avoids requiring a multi-week losing streak before the rule fires | Plan |
| Display location | Dashboard inline per habit | Matches US-01 "opens dashboard and sees recommendation"; minimises navigation | Plan |
| Dismiss persistence | Persisted (`recommendation_dismissed_at` on habits) | Stateless dismiss is annoying UX — recommendation returns on every refresh | Plan |
| Goal adjustment delta | Always ±1×/week | Zero picker UI; safe incremental change | Plan |
| Minimum data for recommendation | 2 complete calendar weeks | Per US-01 AC; below this shows countdown | Plan |
| Week definition | Calendar week Mon–Sun (UTC) | Aligns with CompletionGrid display; avoids timezone ambiguity when comparing date strings | Plan |
| Suppression check | `any(completion.created_at) > recommendation_dismissed_at` | Triggers re-display automatically when user logs new data | Plan |

## Scope

**In scope:**
- `recommendation_dismissed_at` column migration on habits
- `PATCH /api/habits/:id` — accept (update frequency)
- `POST /api/habits/:id/dismiss-recommendation` — dismiss
- `src/lib/recommendation.ts` — pure recommendation engine
- `src/components/habits/HabitCard.tsx` — React card with accept/dismiss
- `src/pages/dashboard.astro` — refactored to compute recommendations server-side

**Out of scope:**
- Recommendation history / audit log
- Configurable window size or threshold (product-defined constants)
- Frequency picker on accept (always ±1)
- Push notifications

## Architecture / Approach

Server-side computation: `dashboard.astro` fetches habits (with `recommendation_dismissed_at`) + all completions within the 3-week window (single query, all habits), groups them in JS, calls `computeRecommendation()` per habit, and passes pre-computed `RecommendationResult` as props to `<HabitCard client:load>`. React HabitCard handles optimistic accept/dismiss via `fetch`, identical pattern to `CompletionGrid` from S-02.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB + API Layer | Migration + PATCH + dismiss endpoints | Type regeneration must happen before Phase 2 code |
| 2. Recommendation Engine | `src/lib/recommendation.ts` pure function | Week boundary computation (UTC off-by-one; same issue fixed in S-02) |
| 3. Dashboard UI | `HabitCard.tsx` + dashboard refactor | Dashboard is currently pure Astro; adding React client components changes its hydration model |

**Prerequisites:** S-01 (habits table) and S-02 (completions table + logging) — both done.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- ~~`Object.groupBy` availability in Cloudflare Workers runtime~~ **Resolved**: `.nvmrc` = 22.14.0 (Node.js 22 has `Object.groupBy`). Adapter is Netlify (not Cloudflare Workers).
- The dismiss suppression check compares completions' `created_at` timestamps — this requires the dashboard completions query to `select("habit_id, completed_on, created_at")`, not just date strings
- A habit created mid-week has its first "available week" start the following Monday — the `computeRecommendation` must handle this edge case correctly

## Success Criteria (Summary)

- Dashboard shows correct recommendation (lower/raise/maintain) for a habit with ≥ 2 full weeks of data
- Accept updates frequency immediately and persists across refresh
- Dismiss hides recommendation; re-appears automatically after logging a new completion
