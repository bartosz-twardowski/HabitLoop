# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

---

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 1

Bootstrap a greenfield project end-to-end with the **shaping chain**:

```
/10x-init  →  /10x-shape  →  /10x-prd  →  (10x-tech-stack-selector)  →  (bootstrapper)
```

The first three skills ship in this lesson; the last two are the next links in the chain.

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Project setup** | |
| `/10x-init` | The project directory is fresh. Scaffolds `context/foundation/lessons.md` and `docs/reference/contract-surfaces.md` so the rest of the workflow has somewhere to write. Run this once per project. |
| **Discovery** | |
| `/10x-shape` | You have an idea and need to turn it into structured shape-notes BEFORE writing a PRD. Greenfield only. Walks vision → persona/access → MVP → FRs (with Socratic challenge) → business logic & data → stack-openness sketch. Surfaces empty-CRUD and MVP-too-big anti-patterns by name. Output: `context/foundation/shape-notes.md` with a resumable `checkpoint:` block. |
| **Document generation** | |
| `/10x-prd` | You have shape-notes (or raw notes) and want a schema-conformant `context/foundation/prd.md`. Generates against the locked schema, routes every gap verbatim into `## Open Questions`, and refuses to invent domain decisions. On collision, prompts overwrite vs. versioned save (`prd-vN.md`). |

### How the chain hands off

- `/10x-init` produces the workflow v2 scaffold (`context/foundation/`, `lessons.md`, `contract-surfaces.md`). `/10x-shape` requires this and will offer to delegate to `/10x-init` if it's missing.
- `/10x-shape` writes `context/foundation/shape-notes.md` with frontmatter `checkpoint:` (current_phase, phases_completed, frs_drafted, quality_check_status). On re-entry, it resumes from the next unfinished phase.
- `/10x-prd` reads `shape-notes.md` (default) or any path you pass, scores the input on a 4-signal heuristic, warns on thin input, and writes `context/foundation/prd.md` against the schema at `skills/10x-shape/references/prd-schema.md` (frontmatter aligned 1:1 with 10x-tech-stack-selector's Q1–Q7).

### What the PRD captures (and what it does NOT)

- **Captured**: vision, persona, success criteria, user stories (Given/When/Then), FRs (FR-NNN), NFRs, business logic (one-sentence rule first), data model, access control, durable implementation decisions, testing strategy, deployment & CI/CD strategy, non-goals, open questions.
- **NOT captured (deliberate)**: framework choices, database choices, file paths, deployment platform. Stack openness is binding — only `product_type` and `tech_preferences.language_family` capture stack-shaped intent. Frameworks are 10x-tech-stack-selector's job.

### Anti-patterns surfaced during shaping

- **Empty-CRUD**: business logic that reduces to "users add and remove records" with no domain rule. `/10x-shape` names it explicitly and prompts for a real rule shape (recommendation, prioritization, classification, validation, scoring, workflow, calculation).
- **MVP-too-big**: first-flow estimate exceeds ~1 week of after-hours work, or > 4 distinct user actions before user-visible value, or requires multiple integrations before payoff. Skill names the expensive pieces and offers concrete scope-down moves.

Both are **soft gates**: they warn but allow override. Overrides are recorded in the checkpoint and surfaced in the PRD's `## Open Questions`.

### Foundation paths used by this lesson

- `context/foundation/shape-notes.md` — `/10x-shape` output
- `context/foundation/prd.md` (or `prd-vN.md`) — `/10x-prd` output
- `context/foundation/lessons.md` — recurring rules & pitfalls (scaffolded by `/10x-init`)
- `docs/reference/contract-surfaces.md` — load-bearing names registry (scaffolded by `/10x-init`)

### Universal language

The shipped skills carry no 10xDevs / cohort / certification references. The mechanics (Socratic challenge, gray-area discovery, recommended-answer fatigue mitigation, soft quality gate) are universal indicators of a well-scoped greenfield project.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
