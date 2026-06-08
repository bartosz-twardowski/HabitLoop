# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (S1-S5); cookbook patterns at the bottom (S6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see S8).
>
> Last updated: 2026-06-08

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost x signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   `<area>`" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (19 commits/30d).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact x likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see S1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Adaptive recommendation produces wrong lower/maintain/raise output for a given completion history | High | High | PRD FR-007/US-01 (core product value), archive S-03 (edge cases: floor at 1x/wk, insufficient data, partial weeks), hot-spot dir `src/lib` — 7 commits/30d |
| 2 | User A reads or writes User B's habits or completions (IDOR) | High | Medium | PRD guardrail ("never visible to another user"), L-001 (RLS was insufficient — API ownership check added as fix), archive data-schema + completion-logging plans |
| 3 | Unauthenticated request reaches protected route or API endpoint and receives data instead of redirect | High | Medium | PRD access control, hot-spot dir `src/components/auth` — 6 commits/30d, `src/pages/api/auth` — 5 commits/30d |
| 4 | Completion with edge-case date (backdated, duplicate, timezone boundary) corrupts the rolling window input data | Medium | High | PRD FR-005 (backdating allowed), archive S-02 (week boundary off-by-one, 409 duplicate detection), hot-spot dir `src/pages/api/habits/[id]/completions` — 4 commits/30d |
| 5 | API accepts frequency outside 1-7 or malformed date string, corrupting habit state | Medium | Medium | PRD FR-004 (1-7 constraint), L-003 (Zod validation mandated at API boundaries) |
| 6 | Recommendation accept/dismiss leaves habit in inconsistent state (frequency updated but recommendation not cleared, or vice versa) | High | Medium | PRD FR-009, archive S-03 (suppression clears on new completion, ceiling/floor at 1 and 7) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Given N weeks of completions at frequency F, the function returns the correct recommendation with correct explanation text | "Happy-path maintain implies lower and raise also work" — all three branches plus edge cases (floor, ceiling, insufficient data, partial week) must be exercised | Entry point for recommendation computation, window size constants, run-length thresholds, how partial weeks are handled | Unit test | Oracle problem: do not copy the rolling-window formula into the test assertion; derive expected values from PRD business rules and hand-calculated examples |
| #2 | User A's API request for User B's habit ID returns 403/404, not data; same for completions CRUD | "RLS alone is sufficient" — L-001 proved it was not; the API-layer ownership check is the real gate | Which endpoints accept a habit ID param, how ownership is verified, whether RLS and API check are both present | Integration test | Over-mocking the auth layer — the test must use two real user contexts |
| #3 | Request without valid session to any protected route/API returns redirect (pages) or 401 (API), never data | "Middleware covers all routes" — check that new routes added since S-01 are in PROTECTED_ROUTES | Middleware route list, which API routes are protected, redirect target | Integration test | Testing only one route and assuming the rest work — enumerate all protected paths |
| #4 | Backdated completion on day D appears in the correct rolling window week; duplicate completion on same day returns 409; date at week boundary is assigned to the right week | "ISO date string is always valid" — the client can send anything; "UTC midnight aligns with user's week boundary" | Date validation logic, how week boundaries are computed, duplicate detection mechanism, timezone handling | Integration test | Timezone-dependent assertions that pass in CI (UTC) but fail locally |
| #5 | POST /api/habits with frequency 0, 8, -1, 3.5, "abc" returns 400 with validation error; POST completions with date "not-a-date" or future date returns 400 | "Zod schema exists so validation works" — the schema must actually reject these inputs at the API handler level | API handler entry points, Zod schemas in use, which fields are validated | Integration test | Testing only the Zod schema object in isolation — test the full API request path |
| #6 | After accepting a "lower" recommendation: frequency is decremented, recommendation is cleared, next dashboard load shows updated frequency. After dismissing: frequency unchanged, recommendation suppressed until next completion | "Accept = frequency update" — but does the recommendation clear? Does the next computation use the new frequency? | Accept and dismiss API endpoints, what state each mutates, when suppression resets | Integration test | Testing accept and dismiss in isolation without verifying the downstream recommendation recomputes correctly |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Unit test bootstrap | Bootstrap Vitest and defend the adaptive recommendation logic and input validation at the cheapest layer | #1, #5 | unit | change opened | testing-unit-bootstrap |
| 2 | API integration tests | Prove all API endpoints enforce ownership, auth, validation, and state transitions correctly | #2, #3, #4, #6 | integration | not started | — |
| 3 | CI quality gates | Wire unit + integration suites into CI; fail the PR if tests fail | cross-cutting | gates | not started | — |

## 4. Stack

The classic test base for this project. No test infrastructure exists yet;
Phase 1 bootstraps the runner.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | none yet — see Phase 1 | Natural choice for Vite-based Astro stack |
| API mocking | none yet — see Phase 2 | — | Supabase test context needed for integration tests |
| e2e | none yet | — | Not scoped in this rollout; add via --refresh when floor is locked |
| accessibility | none yet | — | Not scoped in this rollout |

**Stack grounding tools (current session):**
- Docs: none — not available in current session; checked: 2026-06-08
- Search: WebSearch available — can verify tool versions/APIs; checked: 2026-06-08
- Runtime/browser: none (no Playwright MCP); checked: 2026-06-08
- Provider/platform: Supabase MCP (auth only), Linear MCP (issue tracking) — possible future quality gates; checked: 2026-06-08

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for S3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required (already wired) | syntactic / type drift |
| unit tests | local + CI | required after S3 Phase 1 | logic regressions in recommendation engine and validation |
| integration tests | local + CI | required after S3 Phase 2 | API boundary regressions: auth, ownership, state transitions |
| CI test gate | CI on PR | required after S3 Phase 3 | blocks merge if any test fails |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see S3 Phase N."

### 6.1 Adding a unit test

TBD — see S3 Phase 1 for adaptive recommendation logic and input validation patterns.

### 6.2 Adding an integration test

TBD — see S3 Phase 2 for API endpoint ownership/auth/validation/state-transition patterns.

### 6.3 Adding a test for a new API endpoint

TBD — see S3 Phase 2 for the canonical API integration test pattern covering auth, ownership, validation, and side-effects.

### 6.4 Per-rollout-phase notes

(After each phase lands, /10x-implement appends a 2-3 line note here capturing anything surprising.)

## 7. What We Deliberately Don't Test

Phase 2 interview was skipped. No explicit exclusions recorded. Re-run
`/10x-test-plan --refresh` with the interview to populate this section.

Implicit exclusions based on cost x signal analysis:
- **E2e browser tests** — SSR app; API integration tests cover the server-side request pipeline. Re-evaluate when client-side React interactions grow beyond current scope.
- **AI-native layers (vision, post-edit hooks)** — no risk in the map requires capabilities beyond deterministic tests. Re-evaluate if visual regression or content-drift risks surface.
- **Supabase infrastructure** — managed service; testing the platform is the vendor's job. Test what the app does with the platform (queries, RLS assumptions), not the platform itself.

## 8. Freshness Ledger

- Strategy (S1-S5) last reviewed: 2026-06-08
- Stack versions last verified: 2026-06-08
- AI-native tool references last verified: 2026-06-08 (none in use)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- S7 negative-space no longer matches what the team believes.
