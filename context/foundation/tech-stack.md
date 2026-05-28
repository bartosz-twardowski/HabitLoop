---
starter_id: 10x-astro-starter
package_manager: npm
project_name: habit-loop
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

HabitLoop is a solo-built, auth-gated web app targeting a 3-week MVP timeline with a small user base. The `10x-astro-starter` (Astro + Supabase + Cloudflare) is the recommended default for `(web-app, js)` and clears all four agent-friendly criteria — typed TypeScript end-to-end, strong Astro and Supabase conventions, popular within JS training data, and well-documented. Auth and a PostgreSQL-backed database are included out of the box, matching HabitLoop's FR-001–FR-009 without manual wiring. Cloudflare Pages provides edge deployment with a generous free tier, appropriate for a small-scale launch. GitHub Actions with auto-deploy-on-merge is the starter's natural CI shape for a solo project. Bootstrapper confidence is `first-class` — scaffolding is expected to work but hasn't been run end-to-end; occasional manual steps possible.
