# CI Quality Gate — Plan Brief

> Full plan: `context/changes/testing-ci-gates/plan.md`

## What & Why

Add `npm run test` as a blocking step in the GitHub Actions CI workflow so all 91 unit and
integration tests must pass on every push and PR. Currently the tests exist and pass locally but
CI never runs them — a regression can merge undetected. This is Phase 3 of the test-plan rollout.

## Starting Point

`.github/workflows/ci.yml` runs lint and build but has no test step. The workflow also triggers on
`branches: [master]` while the active branch is `main`, so CI does not fire at all today.

## Desired End State

Every push and PR to `main` runs `npm run test` in CI between `astro sync` and `lint`. A test
failure blocks the build. `test-plan.md` Phase 3 shows `done`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Step position | After `astro sync`, before `lint` | Fail-fast on logic errors before spending time on lint/build | Plan |
| Branch trigger | Fix `master` → `main` in same commit | CI doesn't fire on the real branch without this fix | Plan |
| Env vars for tests | None | All 91 tests mock Supabase — no real credentials needed | Plan |
| test-plan.md update | Same commit | Keeps Phase 3 status in sync with the actual CI state atomically | Plan |

## Scope

**In scope:**
- Insert `npm run test` step in `ci.yml`
- Fix `master` → `main` in CI trigger branches
- Update `test-plan.md` Phase 3 row to `done`

**Out of scope:**
- Test reporters or coverage artifacts in CI
- Supabase test instance in CI
- Vitest transform-cache caching

## Architecture / Approach

Single-phase, two-file edit. No new dependencies, no new scripts. The existing `npm run test`
(`vitest run`) is sufficient — it exits non-zero on any failure, which is exactly what GitHub
Actions needs to block the build.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Wire test gate into CI | `ci.yml` updated, `test-plan.md` closed | Branch rename breaks remote `master` triggers (if any) |

**Prerequisites:** None — tests already pass locally.  
**Estimated effort:** ~1 session, single phase.

## Open Risks & Assumptions

- If `master` branch exists on the remote and other workflows depend on it, renaming to `main` in
  CI triggers removes that protection. Verify no parallel workflows target `master`.

## Success Criteria (Summary)

- `npm run test` passes in CI on push to `main`
- No regressions introduced by the branch rename
- `test-plan.md` Phase 3 reflects `done`
