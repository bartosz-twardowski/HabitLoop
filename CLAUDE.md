# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard rules

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

---

## Project: HabitLoop

Adaptive habit tracker. Users create habits with N×/week frequency targets; the app tracks rolling completion rates and auto-generates recommendations to lower, maintain, or raise targets — no user prompt needed.

Full spec: `@context/foundation/prd.md` | Tech-stack decision: `@context/foundation/tech-stack.md`

---

## Commands

```bash
npm run dev          # Astro dev server (Cloudflare workerd runtime via `astro dev`)
npm run build        # Production build
npm run preview      # Preview the production build locally
npm run lint         # ESLint (type-checked; runs astro check internally)
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier (120-char line width, trailing commas)
```

No test runner is configured yet.

**Supabase local dev** (requires Docker, ≥7 GB RAM free):
```bash
npx supabase start   # Start local Postgres + Auth + Studio
npx supabase stop    # Stop
npx supabase db reset  # Re-apply migrations from scratch
```
Copy `.env.example` → `.env` and fill in `SUPABASE_URL` / `SUPABASE_KEY` from `supabase start` output.
For cloud: get keys from the Supabase project dashboard.

**Deployment** (Cloudflare Workers via Wrangler):
```bash
npx wrangler deploy  # Deploy to production
```

---

## Architecture

**Runtime model:** Astro SSR on Cloudflare Workers (edge). Every page and API route runs server-side; there is no static export.

**Request flow:**
1. `src/middleware.ts` — Runs first on every request. Checks Supabase session; redirects unauthenticated users away from `PROTECTED_ROUTES`. Add new protected paths to that array.
2. `src/pages/` — File-based Astro routing. `.astro` pages handle HTML rendering; `src/pages/api/` routes (`*.ts`) handle JSON/form POST endpoints.
3. `src/lib/supabase.ts` — SSR Supabase client factory. Always construct via this factory inside `Astro.locals` or API handler context; never import a singleton client.

**Component split — the pattern here:**
- `.astro` components for layout, static structure, and server-rendered pages.
- `.tsx` React components only where client-side interactivity is needed (forms with validation state, toggles). Keep them in `src/components/`.
- No React needed for purely presentational UI — use Astro components.

**Path aliases:** `@/*` maps to `src/*` (configured in `tsconfig.json`). Always use `@/` imports, never relative `../../`.

**Env vars:** Defined in `astro.config.mjs` under `env.schema`. Server-only variables (Supabase keys) must use `envField.string({ context: 'server', ... })` — they are never exposed to the client bundle.

**Styling:** Tailwind CSS v4 via Vite plugin. No `tailwind.config.*` file — configuration lives inside `src/styles/global.css` with `@theme` blocks.
