# Habit Creation and Dashboard List — Implementation Plan

## Overview

Build the first user-visible vertical slice of HabitLoop: create a habit, land on a dashboard that lists habits, and navigate to a habit detail stub. This is S-01 and the first slice that exercises the `habits` table created in F-01.

## Current State Analysis

- `src/pages/dashboard.astro` — exists but is a bare shell: email + sign-out button only. No Supabase query, no habit data.
- `src/pages/api/auth/signin.ts` — redirects to `/` on success (not `/dashboard`). This is the root cause of the US-02 gap; fixing it is required here.
- `src/pages/api/auth/signup.ts` — redirects to `/auth/confirm-email`; the confirm-email page then links back to sign-in. No change needed here.
- `src/middleware.ts` — `PROTECTED_ROUTES = ["/dashboard"]`; uses `startsWith`, so `/dashboard/new` is already protected. `/habits/*` is NOT protected yet.
- No `src/pages/dashboard/new.astro`, no `src/pages/habits/` directory, no `src/pages/api/habits/` directory, no `src/components/habits/` directory.
- Established patterns from auth:
  - FormData POST → `src/pages/api/auth/*.ts` → redirect (success or `?error=<msg>`)
  - React form components: `FormField`, `SubmitButton` (useFormStatus), `ServerError`
  - Server errors surfaced via URL query param; read in Astro frontmatter; passed as prop to React island
- L-003: `frequency` must be validated at the API boundary — runtime check `>= 1 && <= 7` as integer.

## Desired End State

- `POST /api/habits` accepts `name` + `frequency`, validates, inserts into `habits`, redirects to `/dashboard`.
- `/dashboard/new` renders a habit creation form (name text input + 1–7 frequency toggle group). On submit → POST to `/api/habits`. Server errors surface via `?error=` param.
- `/dashboard` fetches the authenticated user's habits, shows them as a list (name → detail link, `N×/week` badge, created_at date) or an empty-state card with a CTA to `/dashboard/new`.
- `/habits/[id]` renders a habit detail stub: name, frequency, created_at, back link. 404 if not found / not owner.
- Signin redirects to `/dashboard` on success (fixes US-02 path and the existing `/` bug).
- `npm run lint` passes with no new TypeScript errors.

## What We're NOT Doing

- No completion logging — that is S-02.
- No habit editing or deletion — PRD excludes deletion in MVP; editing is out of scope.
- No streak or completion-rate data on the dashboard — requires completions (S-02).
- No mark-today CTA on habit rows — belongs in S-02.
- No React Hook Form, no Zod — manual validation only, consistent with existing codebase.
- No new Supabase migrations — the `habits` table already exists from F-01.

## Implementation Approach

Five sequential phases:

1. **API route** — build and verify `POST /api/habits` in isolation (curl / Studio SQL).
2. **Creation form + page** — wire the new Astro page and React form component to the API route.
3. **Dashboard list + empty state** — expand `dashboard.astro` to query and render habits.
4. **Habit detail stub + route protection** — add `/habits/[id].astro` and extend `PROTECTED_ROUTES`.
5. **Signin redirect fix** — change signin success redirect from `/` to `/dashboard`.

Each phase has its own automated verification gate. Manual smoke-test is consolidated at the end of Phase 5.

## Critical Implementation Details

**Validation (L-003).** The API route must parse `frequency` as an integer and check `>= 1 && <= 7` before inserting. Do not trust the HTML `min`/`max` attributes. Reject with a redirect to `/dashboard/new?error=<msg>` on failure.

**User identity.** All Supabase inserts and selects must use `context.locals.user.id` (set by middleware). Never accept `user_id` from the form body.

**FormField requires `name` prop** for form submission. The `name` attribute defaults to `id` if `name` is omitted — confirm both `name` and `frequency` fields have correct HTML `name` attributes so FormData contains them.

**Middleware coverage.** `PROTECTED_ROUTES` uses `startsWith`, so `/dashboard/new` is already covered. `/habits/*` is NOT — add `"/habits"` to `PROTECTED_ROUTES` in Phase 4.

**Frequency toggle group.** Seven buttons rendering `1` through `7`. One is `active` at a time via React state (default `3` — middle of the range). The selected value is submitted via a hidden `<input type="hidden" name="frequency" value={freq} />` so it flows through standard FormData submission.

**Signin redirect.** The existing signin API redirects to `/` — this is a pre-existing bug first exposed by this slice (US-02 requires the user to land on dashboard after auth). Fix is a one-line change.

---

## Phase 1: POST /api/habits Route

### Overview

Create the server-side endpoint that validates and persists a new habit. This is the foundation the form POSTs to.

### Changes Required

#### 1. API directory + route handler

**File**: `src/pages/api/habits/index.ts` (new)

**Intent**: Accept a `multipart/form-data` POST, validate `name` and `frequency`, insert into `habits` using the authenticated user's id, redirect to `/dashboard` on success or back to `/dashboard/new?error=` on failure.

**Contract**:

```typescript
import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(
      `/dashboard/new?error=${encodeURIComponent("Service unavailable")}`
    );
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const name = (form.get("name") as string | null)?.trim() ?? "";
  const freqRaw = form.get("frequency") as string | null;
  const frequency = freqRaw !== null ? parseInt(freqRaw, 10) : NaN;

  // Runtime validation per L-003
  if (!name) {
    return context.redirect(
      `/dashboard/new?error=${encodeURIComponent("Habit name is required")}`
    );
  }
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 7) {
    return context.redirect(
      `/dashboard/new?error=${encodeURIComponent("Frequency must be between 1 and 7")}`
    );
  }

  const { error } = await supabase
    .from("habits")
    .insert({ name, frequency, user_id: user.id });

  if (error) {
    return context.redirect(
      `/dashboard/new?error=${encodeURIComponent(error.message)}`
    );
  }

  return context.redirect("/dashboard");
};
```

### Success Criteria

#### Automated Verification

- `npm run lint` passes with no new TypeScript errors
- File exists: `src/pages/api/habits/index.ts`

#### Manual Verification

- Start the dev server (`npm run dev`) and sign in
- POST to `/api/habits` via the browser network tab or a form — confirm redirect to `/dashboard` on valid input
- POST with missing name — confirm redirect to `/dashboard/new?error=...`
- POST with frequency `0` or `8` — confirm validation rejects with error redirect

---

## Phase 2: Habit Creation Form + Page

### Overview

Create the Astro page at `/dashboard/new` and the React form component that users interact with to create a habit.

### Changes Required

#### 1. HabitForm React component

**File**: `src/components/habits/HabitForm.tsx` (new)

**Intent**: Name text input + frequency toggle button group (1–7). Client-side validation on submit. Posts to `/api/habits` via native form. Uses `SubmitButton` for loading state. Accepts `serverError` prop for server-side error display.

**Contract**:

```typescript
"use client";
import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7] as const;

export default function HabitForm({ serverError }: Props) {
  const [name, setName] = useState("");
  const [freq, setFreq] = useState(3);
  const [nameError, setNameError] = useState<string | undefined>();

  function validate() {
    if (!name.trim()) {
      setNameError("Habit name is required");
      return false;
    }
    return true;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!validate()) e.preventDefault();
  }

  return (
    <form method="POST" action="/api/habits" className="space-y-5" onSubmit={handleSubmit} noValidate>
      <FormField
        id="name"
        label="Habit name"
        value={name}
        onChange={(v) => { setName(v); if (nameError) setNameError(undefined); }}
        placeholder="e.g. Morning run"
        error={nameError}
        icon={<BookOpen className="size-4" />}
      />

      <div>
        <p className="mb-2 text-sm text-blue-100/80">Times per week</p>
        <div className="flex gap-2">
          {FREQUENCIES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setFreq(n); }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                freq === n
                  ? "border-purple-400 bg-purple-600 text-white"
                  : "border-white/20 bg-white/10 text-white/70 hover:bg-white/20"
              }`}
              aria-pressed={freq === n}
            >
              {n}
            </button>
          ))}
        </div>
        <input type="hidden" name="frequency" value={freq} />
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating..." icon={<BookOpen className="size-4" />}>
        Create habit
      </SubmitButton>
    </form>
  );
}
```

#### 2. Dashboard new page

**File**: `src/pages/dashboard/new.astro` (new)

**Intent**: Astro page that reads the `?error` query param and renders the `HabitForm` island. Protected automatically by middleware (pathname starts with `/dashboard`).

**Contract**:

```astro
---
import Layout from "@/layouts/Layout.astro";
import HabitForm from "@/components/habits/HabitForm";

const serverError = Astro.url.searchParams.get("error");
---

<Layout title="New Habit">
  <div class="bg-cosmic flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl">
      <h1 class="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
        Create a habit
      </h1>
      <HabitForm client:load serverError={serverError} />
    </div>
  </div>
</Layout>
```

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- Files exist: `src/components/habits/HabitForm.tsx`, `src/pages/dashboard/new.astro`

#### Manual Verification

- Navigate to `/dashboard/new` — form renders with name field + 7 toggle buttons (3 pre-selected)
- Submit with empty name — client-side error appears without page reload
- Submit valid form — redirects to `/dashboard`
- Load `/dashboard/new?error=Something+went+wrong` — red error banner renders above submit button

---

## Phase 3: Dashboard Habits List + Empty State

### Overview

Expand `dashboard.astro` to query the user's habits and render either a list or an empty-state CTA. No completions data yet — just `habits` rows.

### Changes Required

#### 1. Dashboard page

**File**: `src/pages/dashboard.astro` (replace current content)

**Intent**: Fetch authenticated user's habits ordered newest-first. Render a list (name → detail link, `N×/week` badge, date) or an empty-state card with a CTA to `/dashboard/new`.

**Contract**:

```astro
---
import Layout from "@/layouts/Layout.astro";
import { createClient } from "@/lib/supabase";

const supabase = createClient(Astro.request.headers, Astro.cookies);
const habits = supabase
  ? (
      await supabase
        .from("habits")
        .select("id, name, frequency, created_at")
        .order("created_at", { ascending: false })
    ).data ?? []
  : [];
---

<Layout title="Dashboard">
  <div class="bg-cosmic min-h-screen p-6">
    <div class="mx-auto max-w-2xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
          My Habits
        </h1>
        <a
          href="/dashboard/new"
          class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
        >
          + New habit
        </a>
      </div>

      {habits.length === 0 ? (
        <div class="rounded-2xl border border-white/10 bg-white/10 p-10 text-center text-white backdrop-blur-xl">
          <div class="mb-4 text-5xl">🌱</div>
          <h2 class="mb-2 text-xl font-semibold text-white">No habits yet</h2>
          <p class="mb-6 text-sm text-blue-100/60">
            Start by creating your first habit and tracking it week by week.
          </p>
          <a
            href="/dashboard/new"
            class="inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500"
          >
            Create your first habit
          </a>
        </div>
      ) : (
        <ul class="space-y-3">
          {habits.map((habit) => (
            <li>
              <a
                href={`/habits/${habit.id}`}
                class="flex items-center justify-between rounded-xl border border-white/10 bg-white/10 px-5 py-4 text-white transition-colors hover:bg-white/20"
              >
                <span class="font-medium">{habit.name}</span>
                <span class="flex items-center gap-3 text-sm text-blue-100/60">
                  <span class="rounded-full border border-purple-400/40 bg-purple-900/30 px-2.5 py-0.5 text-xs text-purple-200">
                    {habit.frequency}×/week
                  </span>
                  <span>{new Date(habit.created_at).toLocaleDateString()}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
</Layout>
```

### Success Criteria

#### Automated Verification

- `npm run lint` passes

#### Manual Verification

- Sign in as a user with no habits — empty state renders with "Create your first habit" CTA
- Click CTA — navigates to `/dashboard/new`
- Create a habit — redirected to dashboard; habit row appears with name, badge, date
- Create a second habit — both rows visible, newest first

---

## Phase 4: Habit Detail Stub + Route Protection

### Overview

Add the `/habits/[id]` page (required by FR-010) and extend `PROTECTED_ROUTES` to cover the `/habits` path family.

### Changes Required

#### 1. Extend PROTECTED_ROUTES

**File**: `src/middleware.ts`

**Intent**: Add `"/habits"` to the protected routes array so `/habits/[id]` redirects unauthenticated users to sign-in.

**Change**: `const PROTECTED_ROUTES = ["/dashboard", "/habits"];`

#### 2. Habit detail page

**File**: `src/pages/habits/[id].astro` (new)

**Intent**: Fetch a single habit by id (scoped to the authenticated user), render name + frequency + created_at + back link. Return 404 if not found.

**Contract**:

```astro
---
import Layout from "@/layouts/Layout.astro";
import { createClient } from "@/lib/supabase";

const { id } = Astro.params;
const supabase = createClient(Astro.request.headers, Astro.cookies);

if (!supabase || !id) return Astro.redirect("/dashboard");

const { data: habit } = await supabase
  .from("habits")
  .select("id, name, frequency, created_at")
  .eq("id", id)
  .eq("user_id", Astro.locals.user!.id)
  .maybeSingle();

if (!habit) return Astro.redirect("/dashboard");
---

<Layout title={habit.name}>
  <div class="bg-cosmic min-h-screen p-6">
    <div class="mx-auto max-w-xl">
      <a
        href="/dashboard"
        class="mb-6 inline-flex items-center gap-2 text-sm text-blue-100/60 hover:text-white"
      >
        ← Back to dashboard
      </a>
      <div class="rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl">
        <h1 class="mb-4 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
          {habit.name}
        </h1>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-blue-100/60">Frequency</dt>
            <dd>
              <span class="rounded-full border border-purple-400/40 bg-purple-900/30 px-2.5 py-0.5 text-xs text-purple-200">
                {habit.frequency}×/week
              </span>
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-blue-100/60">Created</dt>
            <dd>{new Date(habit.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</Layout>
```

### Success Criteria

#### Automated Verification

- `npm run lint` passes
- Files exist: `src/pages/habits/[id].astro`

#### Manual Verification

- Click a habit row on the dashboard — navigates to `/habits/<uuid>`; page renders name, frequency badge, date, back link
- Navigate to `/habits/nonexistent-uuid` — redirects to `/dashboard`
- Sign out and navigate directly to `/habits/<uuid>` — redirects to `/auth/signin`

---

## Phase 5: Signin Redirect Fix

### Overview

Fix the sign-in API route which currently redirects to `/` on success. After this change the post-auth destination is `/dashboard`, completing the US-02 user journey: sign up → email confirm → sign in → dashboard (empty state CTA → `/dashboard/new`).

### Changes Required

#### 1. Signin redirect

**File**: `src/pages/api/auth/signin.ts`

**Change**: Replace `return context.redirect("/");` with `return context.redirect("/dashboard");`

No other changes to this file.

### Success Criteria

#### Automated Verification

- `npm run lint` passes

#### Manual Verification

- Sign out, then sign in with valid credentials — redirected to `/dashboard` (not `/`)
- Complete the full US-02 flow:
  1. Sign up a new test user (local dev — auto-confirmed)
  2. Navigate to `/auth/confirm-email` → click "Go to sign in"
  3. Sign in → land on `/dashboard` with empty state
  4. Click "Create your first habit" → `/dashboard/new`
  5. Fill in name + select frequency → submit
  6. Redirect to `/dashboard` — habit row appears

---

## Testing Strategy

All manual verification is structured per phase above. The consolidated end-to-end smoke test is in Phase 5's Manual Verification.

### Edge Cases to Exercise

- Create habit with name that is whitespace only → server should reject (after trim)
- Create habit with frequency `0` or `8` via direct POST → API rejects with error redirect
- Navigate to another user's habit UUID → 404/redirect (RLS + `.eq("user_id", ...)` guard)
- Dashboard with many habits → list renders in newest-first order

## References

- PRD: `context/foundation/prd.md` — US-02, FR-004, FR-010
- Roadmap: `context/foundation/roadmap.md` — S-01
- Prerequisite: `context/changes/data-schema/` — F-01 (habits table + RLS)
- Lessons: `context/foundation/lessons.md` — L-003 (frequency validation at API boundary)
- Auth pattern: `src/pages/api/auth/signin.ts`, `src/components/auth/SignInForm.tsx`
- Supabase client: `src/lib/supabase.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: POST /api/habits Route

#### Automated

- [x] 1.1 `npm run lint` passes with no new errors — 5471380
- [x] 1.2 File exists: `src/pages/api/habits/index.ts` — 5471380

#### Manual

- [ ] 1.3 Valid POST redirects to `/dashboard`
- [ ] 1.4 Missing name → error redirect to `/dashboard/new?error=...`
- [ ] 1.5 Frequency out of range → error redirect

### Phase 2: Habit Creation Form + Page

#### Automated

- [x] 2.1 `npm run lint` passes — 86c2f38
- [x] 2.2 Files exist: `src/components/habits/HabitForm.tsx`, `src/pages/dashboard/new.astro` — 86c2f38

#### Manual

- [ ] 2.3 `/dashboard/new` renders with name field + 7 toggle buttons (3 pre-selected)
- [ ] 2.4 Empty name submit → client-side error, no page reload
- [ ] 2.5 Valid submit → redirects to `/dashboard`
- [ ] 2.6 `?error=...` param → error banner renders

### Phase 3: Dashboard Habits List + Empty State

#### Automated

- [x] 3.1 `npm run lint` passes — 4b86e54

#### Manual

- [ ] 3.2 No-habits user sees empty state with CTA
- [ ] 3.3 CTA navigates to `/dashboard/new`
- [ ] 3.4 After creating a habit, row appears with name, `N×/week` badge, date
- [ ] 3.5 Multiple habits render newest-first

### Phase 4: Habit Detail Stub + Route Protection

#### Automated

- [x] 4.1 `npm run lint` passes
- [x] 4.2 File exists: `src/pages/habits/[id].astro`

#### Manual

- [ ] 4.3 Habit row click → `/habits/<uuid>` renders name, badge, date, back link
- [ ] 4.4 Unknown UUID → redirects to `/dashboard`
- [ ] 4.5 Unauthenticated direct URL → redirects to `/auth/signin`

### Phase 5: Signin Redirect Fix

#### Automated

- [ ] 5.1 `npm run lint` passes

#### Manual

- [ ] 5.2 Sign in → lands on `/dashboard`
- [ ] 5.3 Full US-02 flow passes end-to-end
