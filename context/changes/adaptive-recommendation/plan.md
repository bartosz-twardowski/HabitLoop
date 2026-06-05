# Adaptive Recommendation Implementation Plan

## Overview

S-03 implementation: the dashboard automatically evaluates each habit's completion rate over the last 3 completed calendar weeks and surfaces one of three adaptive outputs — lower goal, raise goal, or maintain — with a plain-language explanation. Users can accept (frequency updates ±1×/week) or dismiss (suppressed until a new completion is logged). Habits with fewer than 2 full weeks of data show a countdown instead.

## Current State Analysis

The `habits` table has `id, name, frequency (smallint 1-7), created_at, user_id` with `habits_update_own` RLS policy already in place. The `completions` table has a composite index on `(habit_id, completed_on DESC)` explicitly commented as "for rolling-window queries (FR-007)" in the initial migration. The dashboard (`src/pages/dashboard.astro`) fetches only habits — no completions. No recommendation logic exists anywhere in the codebase.

## Desired End State

When this plan is complete:
- Every habit card on `/dashboard` shows a recommendation badge (lower/raise/maintain) when ≥ 2 full calendar weeks of data exist; otherwise shows "First recommendation in N days"
- Accept button on the habit card calls `PATCH /api/habits/:id`; frequency updates immediately (optimistic UI)
- Dismiss button suppresses the recommendation until a new completion is logged
- The adaptive rule fires on every dashboard load; no manual refresh needed
- Unauthenticated users remain redirected to sign-in (existing middleware covers all of `/habits` and `/dashboard`)

### Key Discoveries

- `habits_update_own` RLS policy (initial migration, line 30) enables direct UPDATE on the habits table without additional policy work
- `idx_completions_habit_date` index (initial migration, line 21) is designed for rolling-window queries per FR-007
- Dashboard is currently pure Astro (server-rendered static links); adding `HabitCard` as a React `client:load` component follows the pattern established by `CompletionGrid` in S-02
- No `src/pages/api/habits/[id]/index.ts` exists yet — the PATCH route is net-new
- L-002: after adding the migration column, `src/types/database.ts` must be regenerated before writing code that references it

## What We're NOT Doing

- No configurable window size or run-length threshold (product-defined constants: 3 weeks, 1-week trigger)
- No push notifications or reminders
- No recommendation history or audit log
- No frequency picker on accept — always exactly ±1×/week
- No batch operations across multiple habits

## Implementation Approach

Three phases in dependency order: DB + API first (schema and persistence), then the recommendation engine (pure business logic, importable and testable), then the UI (dashboard refactor + React component that consumes the engine output).

The dashboard computes all recommendations server-side on every page load: one habits query, one completions query covering the 3-week window (all habits, single query), then pure JS grouping and computation. React `HabitCard` components receive pre-computed recommendation props and manage accept/dismiss interactions via fetch — same pattern as `CompletionGrid`.

## Critical Implementation Details

**Week boundary computation:** Calendar weeks run Monday 00:00 UTC to Sunday 23:59 UTC. Since `completed_on` is stored as a DATE string ("YYYY-MM-DD") without timezone, week boundaries must be computed from UTC-based date arithmetic and compared as ISO strings. Never derive week boundaries from `new Date(timestamptz)` without extracting the date portion first — this is the same UTC off-by-one bug fixed in CompletionGrid (S-02) via `.slice(0, 10)`.

**Dismiss suppression check:** `recommendation_dismissed_at` (timestamptz) is compared against individual completions' `created_at` (timestamptz). The dashboard's completions query must include `created_at` so the engine can determine whether any completion was logged after the dismissal timestamp. If `any(completion.created_at) > recommendation_dismissed_at` → show recommendation again.

**Type regeneration (L-002):** After applying the migration, run `npx supabase gen types typescript --local > src/types/database.ts` before writing any code that references `recommendation_dismissed_at`. Do not add the field manually to the generated file.

**Ownership check order (L-001):** In the PATCH endpoint, verify habit ownership before the UPDATE (same pattern as completion endpoints): `SELECT id FROM habits WHERE id = :id AND user_id = :uid` → 403 if absent, then UPDATE.

---

## Phase 1: DB Migration + API Layer

### Overview

Adds the `recommendation_dismissed_at` column to habits, regenerates types, and creates two JSON API routes: PATCH to update frequency (accept) and POST to record dismissal.

### Changes Required

#### 1. Migration — recommendation_dismissed_at column

**File**: `supabase/migrations/20260605000002_habits_recommendation_dismissed_at.sql`

**Intent**: Add a nullable timestamptz column to habits for tracking when the current recommendation was dismissed. NULL means never dismissed or dismissed state was cleared.

**Contract**:
```sql
ALTER TABLE habits ADD COLUMN recommendation_dismissed_at timestamptz;
```

---

#### 2. Regenerate database types

**File**: `src/types/database.ts`

**Intent**: Expose the new column in generated TypeScript types so dashboard and API routes can reference `recommendation_dismissed_at` without casts.

**Contract**: After applying the migration with a running local Supabase instance, run `npx supabase gen types typescript --local > src/types/database.ts`. Verify that `recommendation_dismissed_at: string | null` appears in the `habits.Row` type before proceeding to Phase 2.

---

#### 3. PATCH endpoint — accept recommendation

**File**: `src/pages/api/habits/[id]/index.ts`

**Intent**: Updates the habit's frequency and clears `recommendation_dismissed_at` (so the next dashboard load re-evaluates with the new frequency). Returns 200 with the updated habit.

**Contract**: Exports `PATCH: APIRoute`. JSON body: `{ frequency: number }`. Validate: integer, 1 ≤ frequency ≤ 7 (per L-003). Ownership check per L-001: `supabase.from("habits").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()` → 403 if absent. Update: `.update({ frequency, recommendation_dismissed_at: null })`. Returns `{ id, frequency }` with status 200. Errors: 400 (invalid frequency), 403 (not owner), 503 (client unavailable).

---

#### 4. POST endpoint — dismiss recommendation

**File**: `src/pages/api/habits/[id]/dismiss-recommendation.ts`

**Intent**: Records the dismissal timestamp so the dashboard can suppress the recommendation until a newer completion is logged.

**Contract**: Exports `POST: APIRoute`. No request body needed. Ownership check per L-001 (same pattern). Update: `.update({ recommendation_dismissed_at: new Date().toISOString() })`. Returns `{ ok: true }` with status 200. Errors: 403, 503.

---

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset`
- `recommendation_dismissed_at: string | null` visible in regenerated `src/types/database.ts`
- Linting passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification

- `PATCH /api/habits/:id` with `{ frequency: 2 }` → 200, habit frequency updated in DB
- `PATCH` with `{ frequency: 0 }` → 400
- `PATCH` for another user's habit id → 403
- `POST /api/habits/:id/dismiss-recommendation` → 200, `recommendation_dismissed_at` set in DB

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Recommendation Engine

### Overview

A pure TypeScript module with no I/O — takes habit data and completions array, returns a typed recommendation result. Isolated from Astro and React so it can be imported by any future consumer without side effects.

### Changes Required

#### 1. Recommendation engine

**File**: `src/lib/recommendation.ts`

**Intent**: Encapsulate the entire adaptive-rule algorithm in one importable module. The dashboard calls `computeRecommendation` without knowing how week boundaries are computed or how suppression logic works.

**Contract**:

```typescript
export type RecommendationResult =
  | { kind: "lower"; newFrequency: number; explanation: string; suppressed: boolean }
  | { kind: "raise"; newFrequency: number; explanation: string; suppressed: boolean }
  | { kind: "maintain"; explanation: string }
  | { kind: "insufficient_data"; daysUntilFirst: number };

export function computeRecommendation(
  habit: {
    frequency: number;
    created_at: string;           // ISO timestamp
    recommendation_dismissed_at: string | null;
  },
  completions: Array<{ completed_on: string; created_at: string }>,
  today?: Date                    // defaults to new Date(); injectable for testing
): RecommendationResult
```

Internal helpers (not exported):
- `getMondayUTC(d: Date): Date` — Monday 00:00 UTC of the week containing `d`
- `toISODateStr(d: Date): string` — "YYYY-MM-DD" from UTC fields (avoids timezone off-by-one)
- `getCompletedWeeks(today: Date, count: number): Array<{ start: string; end: string }>` — last `count` complete Mon-Sun weeks as ISO date string pairs, ordered most-recent first
- `countInWeek(completions: string[], weekStart: string, weekEnd: string): number` — count where `weekStart <= completed_on <= weekEnd`

Algorithm:
1. Compute last 3 completed weeks via `getCompletedWeeks(today, 3)`
2. Determine "available weeks": weeks whose end date is after `habit.created_at.slice(0, 10)` (habit existed that week)
3. If `availableWeeks.length < 2` → compute `daysUntilFirst` and return `insufficient_data`:
   ```
   firstCompleteWeekStart = getMondayUTC(createdDate) + 7 days  // first Mon-Sun week that starts after creation week
   dayAfterSecondComplete = firstCompleteWeekStart + 14 days    // end of 2nd complete week + 1 day
   daysUntilFirst = max(0, diffDays(today, dayAfterSecondComplete))
   ```
   Note: the "available weeks" check uses strict `>` (week end date strictly after created date). A habit created on a Sunday is excluded from that week — only 1 day in the week is not a full week. This is intentional.
4. Count completions in most recent available completed week (week at index 0)
5. Compare `count` vs `habit.frequency`:
   - `count < frequency && frequency > 1` → `lower`, `newFrequency = frequency - 1`
   - `count < frequency && frequency === 1` → `maintain`, explanation notes floor reached
   - `count > frequency && frequency < 7` → `raise`, `newFrequency = frequency + 1`
   - `count > frequency && frequency === 7` → `maintain`, explanation notes ceiling reached
   - `count === frequency` → `maintain`
6. For `lower` and `raise`: set `suppressed = recommendation_dismissed_at !== null && !completions.some(c => c.created_at > recommendation_dismissed_at)`

Explanation strings (plain language, per FR-008):
- lower: `"You completed ${count} of ${frequency} target days last week. Lowering your goal to ${newFrequency}×/week."`
- raise: `"You completed ${count} of ${frequency} target days last week — great! Raising your goal to ${newFrequency}×/week."`
- maintain (on target): `"You're hitting your goal — keep it up!"`
- maintain (floor): `"Your goal is already at the minimum (1×/week). Keep going!"`
- maintain (ceiling): `"You've reached the maximum goal (7×/week). Excellent!"`

Also export the helper used by the dashboard:

```typescript
export function getThreeWeeksAgoDateStr(today?: Date): string
```

Returns the ISO date string for Monday of the 3rd completed week before `today` — used as the `gte` filter in the dashboard completions query.

---

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification

- `computeRecommendation` with 1 bad week (count < frequency) → returns `{ kind: "lower", newFrequency: frequency - 1 }`
- Frequency=1 + bad week → `{ kind: "maintain" }` with floor explanation
- Frequency=7 + good week → `{ kind: "maintain" }` with ceiling explanation
- Fewer than 2 available weeks → `{ kind: "insufficient_data", daysUntilFirst: N }` where N > 0
- Dismissed + no newer completions → `suppressed: true`
- Dismissed + newer completion exists → `suppressed: false`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Dashboard UI

### Overview

Adds the `HabitCard` React component (handles accept/dismiss) and refactors `dashboard.astro` to compute recommendations server-side and pass them as props.

### Changes Required

#### 1. HabitCard React component

**File**: `src/components/habits/HabitCard.tsx`

**Intent**: Displays a habit card with its recommendation section. Handles accept and dismiss via fetch with optimistic UI, following the same pattern as `CompletionGrid`.

**Contract**:

```typescript
import type { RecommendationResult } from "@/lib/recommendation";

interface Props {
  id: string;
  name: string;
  frequency: number;
  createdAt: string;
  recommendation: RecommendationResult;
}
```

State:
- `currentFrequency: number` — initialised from props; optimistically updated on accept
- `rec: RecommendationResult` — initialised from props; updated optimistically on accept/dismiss
- `error: string | null`
- `pending: boolean`

Accept handler (only shown when `rec.kind === "lower" | "raise"` and `!rec.suppressed`):
1. Optimistic: set `currentFrequency = rec.newFrequency`; set `rec = { kind: "maintain", explanation: "Goal updated." }`
2. `PATCH /api/habits/:id` with `{ frequency: rec.newFrequency }`
3. On error: revert both + set `error`

Dismiss handler (only shown when `rec.kind === "lower" | "raise"` and `!rec.suppressed`):
1. Optimistic: set `rec = { ...rec, suppressed: true }`
2. `POST /api/habits/:id/dismiss-recommendation`
3. On error: revert + set `error`

Card structure: the outer container is a `<div>` (not `<a>`) carrying the card's border/background/hover styles. Inside it, an `<a href="/habits/:id">` wraps only the habit name and frequency text. The recommendation section (explanation text + Accept/Dismiss buttons) is a sibling `<div>` next to the `<a>`, not nested inside it. This is valid HTML; no `e.stopPropagation()` is needed.

---

#### 2. Dashboard page refactor

**File**: `src/pages/dashboard.astro`

**Intent**: Extend the habits query, add a completions query for the 3-week window, compute recommendations server-side, and render `HabitCard` components in place of the current static `<a>` list.

**Contract**:

```typescript
import { computeRecommendation, getThreeWeeksAgoDateStr } from "@/lib/recommendation";
import HabitCard from "@/components/habits/HabitCard";

const today = new Date();

// Extended habits query — adds recommendation_dismissed_at
const habits = await supabase
  .from("habits")
  .select("id, name, frequency, created_at, recommendation_dismissed_at")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });

// Single completions query for the entire 3-week window, all habits
const { data: recentCompletions } = await supabase
  .from("completions")
  .select("habit_id, completed_on, created_at")
  .eq("user_id", user.id)
  .gte("completed_on", getThreeWeeksAgoDateStr(today));

// Group by habit_id in JS
const byHabit = Object.groupBy(recentCompletions ?? [], c => c.habit_id);
// (or a manual reduce if Object.groupBy is unavailable at runtime)

// Compute recommendation for each habit
const habitsWithRec = habits.map(h => ({
  ...h,
  recommendation: computeRecommendation(h, byHabit[h.id] ?? [], today),
}));
```

Render each habit using `<HabitCard client:load ... />`. The empty-state ("No habits yet") block remains unchanged.

---

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification

- Dashboard shows recommendation banner for a habit with ≥ 2 full weeks of completion data
- Accept button updates frequency badge on the card immediately (optimistic); recommendation section disappears
- Dismiss button hides recommendation; logging a new completion and refreshing the dashboard shows it again
- Habit with < 2 full weeks shows "First recommendation in N days" instead of a recommendation
- Habit at frequency=1 with a bad week shows maintain-with-floor note (no Accept button)
- Full E2E: create habit → backdate completions for 2+ weeks → dashboard shows recommendation → accept → frequency updated → dashboard reflects new frequency

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps

1. Start local Supabase: `npx supabase start`
2. Apply migration: `npx supabase db reset`
3. Regenerate types: `npx supabase gen types typescript --local > src/types/database.ts`
4. Start dev server: `npm run dev`
5. Create a habit (e.g. 3×/week)
6. Use CompletionGrid to backdate completions: log 1 completion per week for the past 2 weeks (below target of 3)
7. Navigate to dashboard → verify recommendation "lower" appears
8. Click Accept → verify frequency badge changes to 2×/week, recommendation disappears
9. Log a new completion today → refresh dashboard → verify maintain state (if hitting 2×/week target)
10. Create a second habit → verify "First recommendation in N days" appears while data is < 2 weeks

## References

- PRD: `context/foundation/prd.md` — FR-007, FR-008, FR-009, US-01
- Roadmap: `context/foundation/roadmap.md` — S-03 (north star)
- Lessons: `context/foundation/lessons.md` — L-001, L-002, L-003
- Prior slice (patterns): `context/archive/2026-06-05-completion-logging-history/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB Migration + API Layer

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 63f98bd
- [x] 1.2 `recommendation_dismissed_at: string | null` visible in regenerated `src/types/database.ts` — 63f98bd
- [x] 1.3 Linting passes: `npm run lint` — 63f98bd
- [x] 1.4 Type check passes: `npx astro check` — 63f98bd

#### Manual

- [x] 1.5 `PATCH /api/habits/:id` with valid frequency → 200, updated in DB — 63f98bd
- [x] 1.6 `PATCH` with `frequency: 0` → 400 — 63f98bd
- [x] 1.7 `PATCH` for another user's habit → 403 — 63f98bd
- [x] 1.8 `POST /api/habits/:id/dismiss-recommendation` → 200, `recommendation_dismissed_at` set in DB — 63f98bd

### Phase 2: Recommendation Engine

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Type check passes: `npx astro check`

#### Manual

- [x] 2.3 `computeRecommendation` with 1 bad week → returns `{ kind: "lower", newFrequency: frequency - 1 }`
- [x] 2.4 Frequency=1 + bad week → `{ kind: "maintain" }` with floor note
- [x] 2.5 Frequency=7 + good week → `{ kind: "maintain" }` with ceiling note
- [x] 2.6 < 2 available weeks → `{ kind: "insufficient_data", daysUntilFirst: N }` where N > 0
- [x] 2.7 Dismissed + no newer completions → `suppressed: true`
- [x] 2.8 Dismissed + newer completion exists → `suppressed: false`

### Phase 3: Dashboard UI

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Type check passes: `npx astro check`

#### Manual

- [ ] 3.3 Dashboard shows recommendation for habit with ≥ 2 full weeks of data
- [ ] 3.4 Accept updates frequency immediately (optimistic) and removes recommendation banner
- [ ] 3.5 Dismiss hides recommendation; reappears on dashboard after new completion logged
- [ ] 3.6 Habit with < 2 full weeks shows countdown
- [ ] 3.7 Frequency=1 failure: shows maintain-at-min (no Accept button)
- [ ] 3.8 Full E2E: create habit → backdate completions for 2+ weeks → see recommendation → accept → frequency updated
