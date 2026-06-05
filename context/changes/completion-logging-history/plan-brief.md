# Completion Logging & History — Plan Brief

> Full plan: `context/changes/completion-logging-history/plan.md`

## What & Why

S-02 implementation: a user can log a habit completion on any day (including past days) and view the full completion history. This is the second mandatory slice before S-03 (adaptive recommendation) — without completion data the adaptive rule has nothing to compute.

## Starting Point

The `completions` table is fully ready (schema, RLS, indexes). The `/habits/[id].astro` page exists and displays habit data, but neither fetches nor shows any completions. No API routes for completions exist.

## Desired End State

The user opens `/habits/:id`, is redirected to `/habits/:id/log`, and sees an interactive weekly grid with the habit's full history. Clicking a day toggles the completion instantly (optimistic UI) and persists it to Supabase. The page becomes the entry point for the historical data that will feed S-03.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Logging UI | Grid + "Log today" button | Grid handles backdating natively; button is a shortcut for the common case | Plan |
| History scope | All weeks since creation | Full history without pagination — simple at MVP data volumes | Plan |
| Toggle / undo | Yes — click reverses | Better error correction; not required by PRD but improves UX | Plan |
| Page location | /habits/[id]/log replaces /habits/[id] | Single URL; /habits/[id] becomes a redirect | Plan |
| API format | JSON fetch from React | CompletionGrid is a React component with optimistic UI — FormData redirect does not fit | Plan |
| Duplicate day | 409 with message | Grid visually prevents double-click; 409 as last-line guard | Plan |
| RLS ownership | L-001 migration | Insert policy did not check habit_id — security gap ahead of S-02 API | Plan |

## Scope

**In scope:**
- Migration fixing the `completions_insert_own` policy (L-001)
- `POST /api/habits/:id/completions` — log a day
- `DELETE /api/habits/:id/completions/:date` — unlog a day
- `CompletionGrid.tsx` — interactive grid with optimistic UI
- `/habits/[id]/log.astro` — primary habit page
- Redirect `/habits/[id]` → `/habits/[id]/log`

**Out of scope:**
- History pagination
- Future-date validation
- Calendar view with month navigation
- Completion statistics or percentages (belongs to S-03)

## Architecture / Approach

The server (`log.astro`) fetches the habit + all completions and passes them as props to `CompletionGrid` (React, `client:load`). The component manages local state (`Set<string>` of logged dates) and calls JSON fetch to two API routes. Each toggle operation updates the UI optimistically before the server confirms.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration + API Routes | Completions persistence (POST + DELETE) + RLS fix | Correct UNIQUE constraint handling (23505) and ownership guard |
| 2. CompletionGrid | Interactive weekly grid with toggle | Week generation edge case: habit created mid-week |
| 3. Log Page + Redirect | Server–component wiring; old URL redirect | Astro routing `[id].astro` vs `[id]/log.astro` (should not conflict) |

**Prerequisites:** S-01 complete (habit detail page exists, auth working) ✓  
**Estimated effort:** ~2 sessions, 3 phases

## Open Risks & Assumptions

- Grid generation assumes ISO week (Mon–Sun) — if the project has different first-day-of-week preferences, Phase 2 will need adjustment
- With large history (hundreds of rows) the full grid loads at once — acceptable for MVP with a small user base

## Success Criteria (Summary)

- User can log and unlog a habit completion on any day
- Completion history displays correctly after a page refresh
- Full E2E flow (create habit → log completions → refresh → data persisted) works without errors
