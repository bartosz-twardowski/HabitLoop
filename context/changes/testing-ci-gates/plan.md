# CI Quality Gate — Implementation Plan

## Overview

Add `npm run test` as a blocking CI step in `.github/workflows/ci.yml` so unit and integration
tests must pass on every push and pull request. Fix the branch trigger discrepancy (`master` →
`main`) in the same commit, and close Phase 3 of the test-plan rollout.

## Current State Analysis

- `.github/workflows/ci.yml` runs: `npm ci` → `npx astro sync` → `npm run lint` → `npm run build`
- `npm run test` (Vitest 4.1.8) is absent from the workflow — 91 tests exist locally but CI never
  runs them
- Workflow triggers on `branches: [master]`; the active branch is `main` — CI does not fire on the
  real branch
- All 91 tests (unit + integration) mock Supabase via `createMockSupabaseClient`; no real
  credentials are needed to run them

## Desired End State

`npm run test` runs in CI after `astro sync` and before `lint`/`build`. A failure in any test
blocks the build. The workflow triggers correctly on `main`. `context/foundation/test-plan.md`
Phase 3 row shows `done`.

### Key Discoveries

- `src/test-utils/api-helpers.ts` — all integration tests mock Supabase; no `SUPABASE_URL` /
  `SUPABASE_KEY` secrets needed in the test step
- `ci.yml:6,7` — both `push` and `pull_request` branches arrays list `master`; must be changed to
  `main`

## What We're NOT Doing

- Adding test reporters (JUnit XML, coverage HTML) — vanilla Vitest output in CI logs is enough for MVP
- Setting up a Supabase test instance in CI — all tests use mocks
- Adding caching for Vitest's transform cache — test suite runs in ~1.4 s; not needed

## Implementation Approach

Single phase: two file edits committed together.

1. Edit `ci.yml`: insert `- run: npm run test` between `astro sync` and `npm run lint`; change
   `master` → `main` in both trigger branches arrays.
2. Edit `context/foundation/test-plan.md`: flip Phase 3 rollout row status from `not started` →
   `done`, update `Last updated` date.

---

## Phase 1: Wire test gate into CI

### Overview

Edit the CI workflow to add the test step in the correct position, fix the branch trigger, and
close the test-plan Phase 3 row.

### Changes Required

#### 1. Add test step and fix branch trigger

**File**: `.github/workflows/ci.yml`

**Intent**: Insert `npm run test` immediately after `npx astro sync` and before `npm run lint`.
Rename the `master` branch in both `push.branches` and `pull_request.branches` arrays to `main`.

**Contract**: The `on:` block must list `main` (not `master`). The steps order must be:
`npm ci` → `npx astro sync` → `npm run test` → `npm run lint` → `npm run build`. The `npm run
test` step carries no `env:` block — tests do not need Supabase credentials.

#### 2. Close Phase 3 in test-plan rollout

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 3 as delivered now that the CI gate is wired.

**Contract**: In the `## 3. Phased Rollout` table, set the Phase 3 `Status` cell to `done` and
the `Change folder` cell to `testing-ci-gates`. Update the `> Last updated:` date in the header
to today (`2026-06-10`).

### Success Criteria

#### Automated Verification

- `npm run test` passes locally with 0 failures
- `npm run lint` passes with 0 errors (confirms the ci.yml edit is valid YAML via ESLint/Astro check)

#### Manual Verification

- `ci.yml` reviewed: `master` → `main` in both trigger arrays; test step is between `astro sync`
  and `lint`; no `env:` block on the test step
- `test-plan.md` reviewed: Phase 3 row shows `done` and `testing-ci-gates` in the table

---

## References

- CI workflow: `.github/workflows/ci.yml`
- Test plan: `context/foundation/test-plan.md`
- Vitest config: `vitest.config.ts`
- Test helpers: `src/test-utils/api-helpers.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wire test gate into CI

#### Automated

- [x] 1.1 npm run test passes with 0 failures
- [x] 1.2 npm run lint passes with 0 errors

#### Manual

- [x] 1.3 ci.yml reviewed: main in triggers, test step between astro sync and lint, no env block
- [x] 1.4 test-plan.md reviewed: Phase 3 row shows done and testing-ci-gates
