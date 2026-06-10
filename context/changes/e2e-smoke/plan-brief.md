# E2E Smoke Tests — Plan Brief

> Full plan: `context/changes/e2e-smoke/plan.md`

## What & Why

Add a two-test Playwright smoke suite that verifies the live app's most
critical invariants on every PR: unauthenticated users are redirected from
protected pages, and a real user can sign in through the UI. All four roadmap
slices are done; the smoke suite closes the only gap in the testing pyramid
(browser-level coverage is currently absent).

## Starting Point

Playwright `^1.60.0` is already a devDependency and `playwright.config.ts`
exists (untracked) but is unconfigured — no browser projects, no env loading,
no CI job. `tests/e2e/` does not exist. The existing 91 unit/integration tests
cover logic and API endpoints but nothing browser-level.

## Desired End State

`npm run test:e2e` runs two Playwright tests on Chromium:
1. Navigate to `/dashboard` without auth → redirected to `/auth/signin`.
2. Fill sign-in form with test credentials → land on `/dashboard`.

Both tests run in CI (`e2e-smoke` job) and block PR merge on failure.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Smoke scope | Redirect guard + sign-in only | Read-only, no DB state required — keeps suite deterministic and fast | Plan |
| Auth in tests | Real UI sign-in via form | Tests the actual auth flow end-to-end rather than bypassing it | Plan |
| Browser matrix | Chromium only | SSR app with no WebRTC/WebGL — cross-browser adds cost with minimal signal | Plan |
| Test credentials | `.env.test` (gitignored) | Separates test creds from app config; CI reads from GitHub Secrets | Plan |
| CI gate | Blocks PR (`needs: ci`) | Smoke only meaningful if lint + unit pass first; merge gate enforces hygiene | Plan |
| DB isolation | None (read-only tests) | Sign-in creates no habit data; redirect test touches nothing | Plan |

## Scope

**In scope:**
- `playwright.config.ts` update (dotenv, Chromium project, timeout)
- `tests/e2e/smoke.spec.ts` with 2 tests
- `package.json` script `test:e2e` + `dotenv` devDep
- `.gitignore` entry + `.env.test.example`
- `e2e-smoke` CI job in `.github/workflows/ci.yml`

**Out of scope:**
- Habit CRUD or recommendation flow in e2e
- Cross-browser testing
- Local Supabase in CI
- Application code changes

## Architecture / Approach

Playwright's `webServer` option starts `npm run dev` (Astro dev server) before
running tests, then tears it down after. `reuseExistingServer: true` means a
locally running server is reused. Tests read `TEST_USER_EMAIL` /
`TEST_USER_PASSWORD` from `process.env` (loaded from `.env.test` locally, from
GitHub Secrets in CI). The CI job passes `SUPABASE_URL` and `SUPABASE_KEY` to
the Playwright step so the dev server can connect to Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Config & scaffolding | Working Playwright setup: dotenv, Chromium, .env.test | dotenv must be explicit devDep (transitive via Vite but not declared) |
| 2. Smoke test file | Two runnable tests; both pass locally with real credentials | Test 2 skips validation if credentials missing — must guard explicitly |
| 3. CI integration | `e2e-smoke` job blocks PRs; passes once secrets are set | CI job fails until `TEST_USER_EMAIL` + `TEST_USER_PASSWORD` secrets added |

**Prerequisites:** Test user must exist in the Supabase project (local or
cloud). `SUPABASE_URL` / `SUPABASE_KEY` already in CI secrets.  
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- CI assumes the cloud Supabase project is reachable during the `npm run dev`
  startup triggered by Playwright's `webServer`. If the project is paused or
  rate-limited, the smoke job will flake.
- Test user credentials must be kept in sync between local `.env.test` and CI
  secrets. A password rotation breaks CI until the secret is updated.

## Success Criteria (Summary)

- `npm run test:e2e` passes locally with a valid `.env.test`.
- `e2e-smoke` job is green on a PR after `TEST_USER_EMAIL` and
  `TEST_USER_PASSWORD` GitHub Secrets are set.
- Removing a required secret causes the job to fail with a descriptive error
  (not a silent pass).
