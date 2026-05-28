---
bootstrapped_at: 2026-05-28T18:16:00Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: habit-loop
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
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
```

## Why this stack

HabitLoop is a solo-built, auth-gated web app targeting a 3-week MVP timeline with a small user base. The `10x-astro-starter` (Astro + Supabase + Cloudflare) is the recommended default for `(web-app, js)` and clears all four agent-friendly criteria — typed TypeScript end-to-end, strong Astro and Supabase conventions, popular within JS training data, and well-documented. Auth and a PostgreSQL-backed database are included out of the box, matching HabitLoop's FR-001–FR-009 without manual wiring. Cloudflare Pages provides edge deployment with a generous free tier, appropriate for a small-scale launch. GitHub Actions with auto-deploy-on-merge is the starter's natural CI shape for a solo project. Bootstrapper confidence is `first-class` — scaffolding is expected to work but hasn't been run end-to-end; occasional manual steps possible.

## Pre-scaffold verification

| Signal      | Value                                         | Severity    | Notes                                                      |
| ----------- | --------------------------------------------- | ----------- | ---------------------------------------------------------- |
| npm package | not run                                       | n/a         | cmd_template starts with `git clone` — npm check skipped  |
| GitHub repo | not run                                       | n/a         | `gh` CLI not found in PATH; recency check unavailable      |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 18
**Conflicts (.scaffold siblings)**: CLAUDE.md
**.gitignore handling**: append-merged
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0d/1t HIGH; 2d/9t MODERATE

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** v5.6.3–5.8.0
  - Advisory: GHSA-77vg-94rm-hx3p
  - Description: DoS via sparse array deserialization — sending a specially crafted sparse array through `devalue.parse()` can cause an out-of-memory crash
  - CVSS: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
  - Transitive via Astro build toolchain (not user-facing runtime)
  - Fix: `npm audit fix` (non-breaking update available)

#### MODERATE findings

- **wrangler** (direct) — via `miniflare` / `ws` (uninitialized memory disclosure in ws <8.20.1, GHSA-58qx-3vcg-4xpx). Fix available.
- **@astrojs/check** (direct) — via `@astrojs/language-server` → `volar-service-yaml` → `yaml` (stack overflow via deeply nested YAML, GHSA-48c2-rrv3-qjmp). Fix: downgrade to @astrojs/check 0.9.2 (semver major).
- **@cloudflare/vite-plugin** (transitive) — via `miniflare` and `wrangler`. Fix available.
- **miniflare** (transitive) — via `ws`. Fix available.
- **ws** (transitive) — uninitialized memory disclosure (GHSA-58qx-3vcg-4xpx). Fix available.
- **yaml** (transitive via yaml-language-server) — stack overflow via deeply nested YAML (GHSA-48c2-rrv3-qjmp). Fix: @astrojs/check downgrade.
- **yaml-language-server** (transitive) — via `yaml`. Fix: @astrojs/check downgrade.
- **volar-service-yaml** (transitive) — via `yaml-language-server`. Fix: @astrojs/check downgrade.
- **@astrojs/language-server** (transitive) — via `volar-service-yaml`. Fix: @astrojs/check downgrade.

All MODERATE findings are in dev/tooling dependencies (language server, wrangler CLI, Cloudflare local dev tools) — not in the app's production runtime.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                  |
| ----------------------- | ---------------------- |
| bootstrapper_confidence | first-class            |
| quality_override        | false                  |
| path_taken              | standard               |
| self_check_answers      | null                   |
| team_size               | solo                   |
| deployment_target       | cloudflare-pages       |
| ci_provider             | github-actions         |
| ci_default_flow         | auto-deploy-on-merge   |
| has_auth                | true                   |
| has_payments            | false                  |
| has_realtime            | false                  |
| has_ai                  | false                  |
| has_background_jobs     | false                  |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review `CLAUDE.md.scaffold` and decide whether to merge any content from the starter's CLAUDE.md into your own.
- Run `npm audit fix` to resolve the auto-fixable vulnerabilities (wrangler, ws, miniflare chain). The HIGH `devalue` finding is also auto-fixable.
- Address the `@astrojs/check` MODERATE chain at your own pace — it is dev tooling only and requires a semver-major downgrade to resolve.
- Commit the scaffolded project to start your own repo history.
