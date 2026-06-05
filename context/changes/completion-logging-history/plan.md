# Completion Logging & History Implementation Plan

## Overview

S-02 implementation: a user can log a habit completion on any day (including past days) and view the full completion history in an interactive weekly grid. The `/habits/[id]` page is replaced by `/habits/[id]/log`, which combines habit data with the interactive grid.

## Current State Analysis

The `completions` table is ready: `(habit_id, user_id, completed_on DATE, created_at)` with a UNIQUE constraint on `(habit_id, completed_on)`, RLS, and a composite index on `(habit_id, completed_on DESC)`. The `/habits/[id].astro` page exists but shows only the habit name, frequency, and creation date — no completion data. No API routes for completions exist.

The `completions_insert_own` RLS policy only checks `user_id = auth.uid()` without verifying `habit_id` ownership (L-001) — a corrective migration is required.

## Desired End State

When this plan is complete:
- `GET /habits/:id` redirects to `/habits/:id/log`
- `GET /habits/:id/log` displays the habit name, frequency, and an interactive weekly grid covering all weeks from the habit's creation date to today
- Each day cell in the grid is a clickable toggle: clicking an unlogged day logs it; clicking a logged day removes it
- `POST /api/habits/:id/completions` and `DELETE /api/habits/:id/completions/:date` handle persistence
- A duplicate-day POST returns 409 with a readable error message

End-to-end verification: sign in → create a habit → navigate to `/habits/:id/log` → click several days (including past ones) → refresh the page → logged days still visible.

### Key Discoveries

- `src/pages/habits/[id].astro` and `src/pages/habits/[id]/log.astro` are distinct Astro routes — no routing conflict
- The existing Supabase client (`src/lib/supabase.ts`) is fully typed via `src/types/database.ts` — use directly in API routes
- S-01 pattern: validate at the API boundary, use `context.locals.user.id` as `user_id`, return JSON responses with appropriate HTTP status codes
- `src/components/habits/HabitForm.tsx` demonstrates the React component pattern with local state and fetch — CompletionGrid follows the same pattern
- Middleware protects `/habits` — `/habits/[id]/log` is automatically protected

## What We're NOT Doing

- No history pagination — full history in a single view (MVP)
- No "cannot log future dates" validation — PRD does not require it; backdating is permitted per FR-005
- No push notifications or reminders (parked)
- No habit editing (parked)
- No calendar view with month navigation (out of MVP scope per PRD §FR-006)
- No `GET /api/habits/:id/completions` endpoint — the server page fetches completions directly via the Supabase client

## Implementation Approach

Three phases in dependency order: database + API first (persistence layer), then the React component (UI layer), then the Astro page and redirect (shell layer).

The API uses JSON responses instead of FormData redirects because `CompletionGrid` calls `fetch()` as a React client — this is an intentional departure from the S-01 pattern (FormData + redirect), which suits Astro forms but not React components with optimistic UI.

## Critical Implementation Details

**Operation order in the POST endpoint:** verify habit ownership before the insert (`SELECT habit WHERE id = :id AND user_id = :uid` → 403 if absent), then INSERT — never the reverse. Do not rely solely on RLS as the authorization guard per L-001.

**Optimistic updates in CompletionGrid:** update the component state (`Set<string>` of logged dates) before the fetch call; revert on error. Without this the grid appears frozen for the duration of the request.

## Phase 1: DB Migration + API Routes

### Overview

Fixes the RLS policy (L-001) and adds two API routes: POST to log a completion, DELETE to remove one.

### Changes Required

#### 1. RLS migration — ownership check

**File**: `supabase/migrations/20260605000001_completions_insert_ownership.sql`

**Intent**: Replace the loose `completions_insert_own` policy with a version that includes a sub-select verifying the `habit_id` belongs to the inserting user. Eliminates the attack vector described in L-001.

**Contract**:
```sql
DROP POLICY IF EXISTS "completions_insert_own" ON completions;
CREATE POLICY "completions_insert_own" ON completions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM habits WHERE habits.id = completions.habit_id AND habits.user_id = auth.uid()
  )
);
```

---

#### 2. POST endpoint — log completion

**File**: `src/pages/api/habits/[id]/completions/index.ts`

**Intent**: Accepts a JSON body `{ completed_on: string }`, validates the ISO date format (L-003), verifies habit ownership (L-001), and inserts a row into `completions`. Returns `200 OK` with `{ id, completed_on }` or `400` (validation), `403` (not owner), `409` (duplicate day), `503` (Supabase client unavailable).

**Contract**: Exports `POST: APIRoute`. Reads habit id from `context.params.id`. JSON body: `{ completed_on: "YYYY-MM-DD" }`. Date validation: regex `/^\d{4}-\d{2}-\d{2}$/` + `!isNaN(Date.parse(completed_on))`. Ownership check: `supabase.from("habits").select("id").eq("id", id).eq("user_id", user.id).maybeSingle()` — return 403 if null. Insert: `supabase.from("completions").insert({ habit_id: id, user_id: user.id, completed_on })`. Detect duplicate by `error.code === "23505"` → 409.

---

#### 3. DELETE endpoint — unlog completion

**File**: `src/pages/api/habits/[id]/completions/[date].ts`

**Intent**: Deletes the completions row for the given habit and date. Returns `200 OK` or `400` (invalid date format), `403` (not owner or row does not exist — merged to avoid leaking existence of other users' rows), `503`.

**Contract**: Exports `DELETE: APIRoute`. Reads `id` and `date` from `context.params`. Date validation: same regex as in POST. Delete: `supabase.from("completions").delete().eq("habit_id", id).eq("user_id", user.id).eq("completed_on", date)` — the `user_id` condition in the WHERE clause ensures only owned rows are deleted. If `count === 0`, return 403 (row absent or not owner).

---

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset`
- Linting passes: `npm run lint`

#### Manual Verification

- `POST /api/habits/:id/completions` with a valid date → 200 + row in DB
- `POST` with a date that already exists → 409 with message `"This day is already logged"`
- `POST` with an invalid date format → 400
- `POST` with a `habit_id` belonging to another user → 403
- `DELETE /api/habits/:id/completions/:date` → 200 + row removed from DB
- `DELETE` for a non-existent date → 403

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: CompletionGrid React Component

### Overview

The interactive weekly grid — the core UI element of S-02. Renders all weeks from the habit's creation date to today. Each day cell is a clickable toggle that calls POST or DELETE and updates the UI optimistically.

### Changes Required

#### 1. CompletionGrid component

**File**: `src/components/habits/CompletionGrid.tsx`

**Intent**: Receives server-side props (habit data + array of logged dates), generates the weekly grid, and manages toggles via fetch.

**Contract**: Props:
```typescript
interface Props {
  habitId: string;
  habitCreatedAt: string;       // ISO timestamp — first week boundary
  frequency: number;            // displayed in the section header
  initialCompletions: string[]; // array of "YYYY-MM-DD" strings
}
```
State: `useState<Set<string>>(new Set(initialCompletions))` as `loggedDates`. Week generation: from the Monday of the week containing `habitCreatedAt` to the Sunday of the week containing `new Date()`. Each week is 7 cells (Mon–Sun). Cells before `habitCreatedAt` have `aria-disabled` and do not respond to clicks. Today's cell has a distinct border/style. Toggle: if date is in `loggedDates` → call DELETE → remove from set; otherwise → call POST → add to set. Revert optimistic change on error and display an error message.

---

#### 2. "Log today" button

**File**: `src/components/habits/CompletionGrid.tsx` (inside the same component)

**Intent**: A shortcut above the grid that toggles today's completion — removes the need to locate today's cell in a large grid.

**Contract**: Button renders above the grid. Its label and style depend on state: "Log today" (not logged) or "Logged today ✓" (logged). Click invokes the same toggle logic as clicking a cell.

---

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification

- Grid renders all weeks from the habit's creation date to today
- Clicking an unlogged day immediately marks it (optimistically) and calls POST
- Clicking a logged day immediately unmarks it and calls DELETE
- On network error the optimistic change is reverted
- Today's cell is visually distinct
- Days before the habit's creation date are non-interactive
- "Log today" button works correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Log Page + Redirect

### Overview

Creates the `/habits/[id]/log` page as the primary habit view and turns the existing `/habits/[id]` into a redirect.

### Changes Required

#### 1. Log page

**File**: `src/pages/habits/[id]/log.astro`

**Intent**: Server page that (a) fetches the habit + all completions for the authenticated user, and (b) renders `CompletionGrid` with that data as props. Preserves the same auth guard as the old `[id].astro` (redirect to `/dashboard` if habit not found or Supabase client unavailable).

**Contract**: Fetch habit: `.from("habits").select("id, name, frequency, created_at").eq("id", id).eq("user_id", user.id).maybeSingle()`. Fetch completions: `.from("completions").select("completed_on").eq("habit_id", id).eq("user_id", user.id).order("completed_on", { ascending: false })`. Pass to `<CompletionGrid client:load habitId={habit.id} habitCreatedAt={habit.created_at} frequency={habit.frequency} initialCompletions={completions.map(c => c.completed_on)} />`.

---

#### 2. Redirect old detail view

**File**: `src/pages/habits/[id].astro`

**Intent**: Replace the existing page content with a simple server-side redirect to `/habits/[id]/log`. Preserves the old URL as an alias.

**Contract**: Remove all HTML rendering logic. Keep only the frontmatter that calls `return Astro.redirect(\`/habits/${id}/log\`)` after validating `id`.

---

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- Type check passes: `npx astro check`

#### Manual Verification

- `GET /habits/:id` redirects to `/habits/:id/log`
- `/habits/:id/log` displays habit name, frequency, and the completion grid
- Full E2E flow: create habit → `/habits/:id/log` → log several days → refresh → data persisted
- Unauthenticated user at `/habits/:id/log` is redirected to signin (via middleware)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation.

---

## Testing Strategy

### Manual Testing Steps

1. Start local Supabase: `npx supabase start`
2. Apply migrations: `npx supabase db reset`
3. Start dev server: `npm run dev`
4. Sign up and create a habit
5. Navigate to `/habits/:id` → verify redirect to `/habits/:id/log`
6. Click today's cell in the grid → verify it becomes marked
7. Refresh the page → verify the mark persisted
8. Click the same cell again → verify it becomes unmarked
9. Click a past day (backdating) → verify it is marked and saved to DB
10. Access `/habits/:id/log` while logged out → verify redirect to signin

## References

- PRD: `context/foundation/prd.md` — FR-005, FR-006, US-02
- Roadmap: `context/foundation/roadmap.md` — S-02
- Lessons: `context/foundation/lessons.md` — L-001, L-002, L-003
- Prior slice (patterns): `context/archive/2026-06-03-habit-creation-dashboard/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: DB Migration + API Routes

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [x] 1.3 POST logs a completion and returns 200
- [x] 1.4 POST with a duplicate day returns 409
- [x] 1.5 POST with an invalid date format returns 400
- [x] 1.6 POST with another user's habit_id returns 403
- [x] 1.7 DELETE removes a completion and returns 200
- [x] 1.8 DELETE for a non-existent date returns 403

### Phase 2: CompletionGrid React Component

#### Automated

- [ ] 2.1 npm run lint passes
- [ ] 2.2 npx astro check passes (no type errors)

#### Manual

- [ ] 2.3 Grid renders all weeks from habit creation to today
- [ ] 2.4 Clicking an unlogged day marks it optimistically and calls POST
- [ ] 2.5 Clicking a logged day unmarks it and calls DELETE
- [ ] 2.6 Network error reverts the optimistic change
- [ ] 2.7 Today's cell is visually distinct
- [ ] 2.8 Days before habit creation are non-interactive
- [ ] 2.9 "Log today" button works correctly

### Phase 3: Log Page + Redirect

#### Automated

- [ ] 3.1 npm run lint passes
- [ ] 3.2 npx astro check passes

#### Manual

- [ ] 3.3 GET /habits/:id redirects to /habits/:id/log
- [ ] 3.4 /habits/:id/log displays habit data and the completion grid
- [ ] 3.5 Full E2E flow: create habit → log completions → refresh → data persisted
- [ ] 3.6 Unauthenticated user is redirected to signin
