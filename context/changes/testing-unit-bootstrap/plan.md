# Unit Test Bootstrap — Implementation Plan

## Overview

Vitest, its configuration, and the unit test files for the adaptive recommendation engine and
input validation already exist in the repository. This plan verifies that the setup is complete,
fills in the cookbook section of the test-plan, and closes the change.

## Current State Analysis

All bootstrapping work is already present:

- `vitest.config.ts` — configures the `@/` alias and `include: ["src/**/*.test.ts"]` glob
- `package.json` — `"test": "vitest run"` and `"test:watch": "vitest"` scripts; `vitest ^4.1.8` in devDependencies
- `src/lib/recommendation.test.ts` — 36 unit tests covering `getMondayUTC`, `toISODateStr`,
  `getCompletedWeeks`, `countInWeek`, `isSuppressed`, `getThreeWeeksAgoDateStr`, and all 10
  `computeRecommendation` scenarios (lower / raise / maintain / floor / ceiling / insufficient\_data /
  suppression on/off / zero completions)
- `src/lib/validation.test.ts` — 19 unit tests covering `validateFrequency` (valid range, boundary
  integers, floats, strings, null, undefined, object) and `validateCompletionDate` (valid ISO dates,
  format variants, month 13, wrong types)
- `npm run test` — 91 tests pass, 0 fail (includes the unit tests above plus integration tests from
  prior changes)

## Desired End State

`npm run test` passes with at least the 55 unit tests (36 + 19) described above, and
`context/foundation/test-plan.md` section 6.1 contains the canonical pattern for writing a new unit
test in this project. The Phase 1 row in the test-plan rollout table reflects status `done`.

### Key Discoveries

- `src/lib/recommendation.test.ts:166` — all expected values are hand-calculated from PRD business
  rules (not derived from the implementation formula), which satisfies the anti-oracle-problem
  guidance in the Risk Response Guidance table.
- `src/lib/validation.test.ts:59` — known limitation: `"2026-02-30"` passes `Date.parse()` in V8
  and rolls to Mar 2; this is documented in the test file and deferred to the DB layer.
- `vitest.config.ts:9` — `include: ["src/**/*.test.ts"]` picks up both unit and integration test
  files; the integration tests run fine because they mock Supabase via `createMockSupabaseClient`.

## What We're NOT Doing

- Adding new unit tests — coverage is complete for Risks #1 and #5 as defined in the test-plan.
- Changing any source files (`recommendation.ts`, `validation.ts`).
- Wiring CI — that is Phase 3 of the test-plan rollout.

## Implementation Approach

Single phase: verify automated checks pass, fill in the test-plan cookbook section 6.1 and update
the rollout table, commit.

## Phase 1: Verify and lock the unit test foundation

### Overview

Run `npm run test` to confirm all tests pass, then update `context/foundation/test-plan.md` with
the cookbook pattern for unit tests (section 6.1) and mark Phase 1 of the rollout as `done`.

### Changes Required

#### 1. Verify tests pass

**File**: (no file change — command only)

**Intent**: Confirm `npm run test` exits 0 with all tests green before touching any documentation.

**Contract**: `npm run test` must report 0 failures. If it does not, stop and investigate before
proceeding.

#### 2. Update test-plan.md — cookbook section 6.1

**File**: `context/foundation/test-plan.md`

**Intent**: Fill in the "TBD" placeholder in section 6.1 with the canonical pattern so future
contributors know how to add a unit test in this project.

**Contract**: Replace the `TBD — see S3 Phase 1` line under `### 6.1 Adding a unit test` with
the pattern below. Also update the Phase 1 row in the `## 3. Phased Rollout` table: change
`change opened` → `done` and fill the Change folder column if still showing `—`.

Pattern to insert under 6.1:

```markdown
Unit tests live in `src/lib/*.test.ts` alongside the module under test. Import from `vitest`
directly (`describe`, `it`, `expect`). Use the `@/` alias for imports (e.g.
`import { computeRecommendation } from "@/lib/recommendation"`).

**Rules for this project:**
- Expected values must be hand-calculated from PRD business rules, never derived by running the
  implementation and copying the output (oracle anti-pattern).
- Name tests as complete sentences: `"returns lower when completions are below target"`.
- For `computeRecommendation`, always pin `today` to a fixed UTC date to keep tests deterministic
  across timezones and CI runs.
- Run with `npm run test` (one-shot) or `npm run test:watch` (interactive).
```

### Success Criteria

#### Automated Verification

- Tests pass: `npm run test` exits 0 with 0 failures

#### Manual Verification

- `context/foundation/test-plan.md` section 6.1 is filled in (no longer reads "TBD")
- Phase 1 row in the rollout table shows status `done`

---

## References

- Test plan: `context/foundation/test-plan.md`
- Recommendation unit tests: `src/lib/recommendation.test.ts`
- Validation unit tests: `src/lib/validation.test.ts`
- Vitest config: `vitest.config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Verify and lock the unit test foundation

#### Automated

- [x] 1.1 Tests pass: npm run test exits 0 with 0 failures

#### Manual

- [ ] 1.2 test-plan.md section 6.1 is filled in (no longer reads "TBD")
- [ ] 1.3 Phase 1 row in the rollout table shows status done
