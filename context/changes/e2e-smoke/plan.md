# E2E Smoke Tests Implementation Plan

## Overview

Add a minimal Playwright smoke suite that proves the two most critical
invariants of the live app on every PR: (1) unauthenticated requests to
protected pages are redirected to `/auth/signin`, and (2) a real user can
sign in through the UI and reach the dashboard. The suite is intentionally
narrow — read-only, no DB mutations — so it stays fast, deterministic, and
CI-friendly.

## Current State Analysis

- `playwright.config.ts` exists at repo root (untracked) but is minimal:
  no browser projects, no timeout, no env loading.
- `tests/e2e/` directory does not exist.
- `@playwright/test ^1.60.0` is already in `devDependencies`.
- No `test:e2e` script in `package.json`.
- `.gitignore` ignores `.env` and `.env.production` but not `.env.test`.
- CI job (`.github/workflows/ci.yml`) runs lint + unit tests + build; no e2e
  job.
- 91 unit/integration tests covering logic and API endpoints; no browser-level
  coverage.

## Desired End State

Running `npm run test:e2e` locally (with `.env.test` populated) executes two
Playwright tests on Chromium:

1. **Redirect guard** — navigates to `/dashboard` without auth, asserts final
   URL is `/auth/signin`. Requires no credentials.
2. **Sign-in flow** — fills `/auth/signin` form with `TEST_USER_EMAIL` /
   `TEST_USER_PASSWORD`, submits, asserts final URL is `/dashboard`.

Both tests pass in CI via the `e2e-smoke` job, which blocks PR merge on
failure. CI secrets `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` must be added
once to the GitHub repository.

### Key Discoveries

- `src/middleware.ts` protects `/dashboard` and `/habits`; redirect target is
  `/auth/signin` (confirmed in source).
- `SignInForm.tsx` uses `<label htmlFor="email">Email</label>` and
  `<label htmlFor="password">Password</label>`; submit button text is
  `"Sign in"`. These map directly to Playwright's `getByLabel` / `getByRole`.
- The form action is a native `POST /api/auth/signin`; success redirects to
  `/dashboard` server-side — no JS routing involved.
- `dotenv` is not a direct `devDependency`; must be added explicitly (used
  transitively via Vite but not declared).
- `webServer.command` (`npm run dev`) inherits the job's environment variables,
  so `SUPABASE_URL` and `SUPABASE_KEY` passed to the `playwright test` step
  also reach the Astro dev server.

## What We're NOT Doing

- No habit CRUD or completion logging in tests (would require DB state and
  cleanup).
- No test for the recommendation accept/dismiss flow (S-03 coverage stays in
  integration tests).
- No cross-browser testing (Firefox, Safari).
- No `storageState` session reuse — the suite is two tests; sign-in overhead
  is negligible.
- No local Supabase (`npx supabase start`) in CI — tests run against the cloud
  Supabase project already wired to the existing CI secrets.
- No changes to application code.

## Implementation Approach

Three phases in dependency order:

1. Config & scaffolding — update `playwright.config.ts`, add npm script, add
   dotenv dep, gitignore `.env.test`, create `.env.test.example`.
2. Smoke test file — write `tests/e2e/smoke.spec.ts` with the two scenarios.
3. CI wiring — add `e2e-smoke` job to `ci.yml`; job depends on `ci` and
   passes four secrets to the Playwright process.

---

## Phase 1: Playwright config & env scaffolding

### Overview

Make the Playwright setup production-ready: load test credentials from
`.env.test`, restrict to Chromium, set a reasonable web-server startup
timeout, and document required env vars.

### Changes Required

#### 1. Install dotenv as explicit devDependency

**File**: `package.json` (via `npm install`)

**Intent**: `dotenv` is used in `playwright.config.ts` to load `.env.test`.
It is present as a transitive dep but must be explicit to survive dependency
pruning.

**Contract**: Run `npm install -D dotenv`; `"dotenv"` appears in
`devDependencies`.

---

#### 2. Update `playwright.config.ts`

**File**: `playwright.config.ts`

**Intent**: Load test credentials from `.env.test` before test execution,
restrict browser matrix to Chromium, and give the dev server 60 s to start
(cold start in CI can be slow).

**Contract**: File must:
- Call `config({ path: ".env.test" })` from `dotenv` before `defineConfig`
- Add `projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]`
- Import `devices` from `"@playwright/test"`
- Set `webServer.timeout: 60_000`
- Keep `testDir`, `baseURL`, `reuseExistingServer` as-is

---

#### 3. Add `test:e2e` script

**File**: `package.json`

**Intent**: Provide a stable script name for local and CI invocation.

**Contract**: `"test:e2e": "playwright test"` added to `"scripts"`.

---

#### 4. Gitignore `.env.test`

**File**: `.gitignore`

**Intent**: Keep test credentials out of version control.

**Contract**: Add `.env.test` to the `# environment variables` block alongside
`.env` and `.env.production`.

---

#### 5. Create `.env.test.example`

**File**: `.env.test.example` (new file, committed)

**Intent**: Document required test-credential variables so developers can
provision their own test account.

**Contract**:
```
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```
Optionally a one-line comment above each var explaining what it must be
(an existing Supabase account for the local or cloud project in use).

### Success Criteria

#### Automated Verification

- `npm install` completes without error; `dotenv` appears in
  `node_modules/dotenv/`.
- `npx playwright test --list` (no `.env.test` needed for listing) exits 0
  and prints the two test names from Phase 2.
- `npm run lint` still passes — no new ESLint violations from config changes.

#### Manual Verification

- `cat .gitignore` shows `.env.test` in the env section.
- `cat .env.test.example` shows both variable names with empty values.
- Create a local `.env.test` with real credentials; `npx playwright test
  --list` exits 0.

**Implementation Note**: Phase 1 produces no runnable tests. "Automated
Verification" above can only be fully confirmed once Phase 2 adds the test
file. Run `--list` after Phase 2 lands. Pause for manual confirmation before
Phase 3.

---

## Phase 2: Smoke test file

### Overview

Write `tests/e2e/smoke.spec.ts` with the two smoke scenarios. No DB
mutations; both tests pass without any pre-existing habit data.

### Changes Required

#### 1. Create `tests/e2e/smoke.spec.ts`

**File**: `tests/e2e/smoke.spec.ts` (new file; directory created implicitly)

**Intent**: Two independent tests that verify auth redirect and sign-in flow.
Each test must be self-contained (no `beforeAll` state shared between them).

**Contract**:

- **Test 1 — "unauthenticated user is redirected from /dashboard to
  /auth/signin"**: `page.goto("/dashboard")` → assert `page.url()` ends with
  `/auth/signin`. No credentials required. Must not touch `process.env`.

- **Test 2 — "user can sign in and reach /dashboard"**: Read
  `process.env.TEST_USER_EMAIL` and `process.env.TEST_USER_PASSWORD`; throw a
  descriptive error if either is missing. Navigate to `/auth/signin`; fill
  `getByLabel("Email")` and `getByLabel("Password")`; click
  `getByRole("button", { name: "Sign in" })`; assert `page.url()` ends with
  `/dashboard`.

- Both tests use `expect(page).toHaveURL(...)` (not `.url()` string
  comparison) so Playwright handles trailing-slash normalization.

- File-level `test.use({ storageState: undefined })` or no `use` at all —
  each test begins with a fresh, unauthenticated browser context (Playwright
  default).

### Success Criteria

#### Automated Verification

- `npx playwright test --list` shows exactly 2 tests under
  `tests/e2e/smoke.spec.ts`.
- `npm run test:e2e` (with `.env.test` present) exits 0; both tests pass.
- Test 1 passes even when `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` are absent
  from `.env.test` (redirect test needs no credentials).

#### Manual Verification

- Run `npm run test:e2e` with a valid `.env.test`; observe Playwright open
  Chromium, navigate, and pass both tests in the terminal output.
- Introduce a deliberate failure (e.g., wrong password in `.env.test`); test 2
  fails with a clear message.

**Implementation Note**: The dev server must be running or Playwright will
start it. If `reuseExistingServer: true` and port 4321 is free, Playwright
launches `npm run dev` automatically. Pause here for manual confirmation before
wiring CI.

---

## Phase 3: CI integration

### Overview

Add a `e2e-smoke` job to `.github/workflows/ci.yml` that runs the Playwright
suite on every PR and push to `main`, blocking merge on failure.

### Changes Required

#### 1. Add `e2e-smoke` job to `.github/workflows/ci.yml`

**File**: `.github/workflows/ci.yml`

**Intent**: Run the smoke suite in CI after the main `ci` job passes (no point
running browser tests if lint or unit tests are broken). Install only
the Chromium browser binary to keep CI fast.

**Contract**: New job `e2e-smoke` with `needs: ci`:
```yaml
e2e-smoke:
  needs: ci
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run test:e2e
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
        TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

`SUPABASE_URL` and `SUPABASE_KEY` are passed so the `npm run dev` webServer
subprocess can connect to Supabase when serving the app.

#### 2. Document required GitHub Secrets (no file change — ops task)

**Intent**: Before the CI job can pass, two new secrets must be added to the
GitHub repository settings: `TEST_USER_EMAIL` and `TEST_USER_PASSWORD`.

**Contract**: The test user identified by these credentials must exist in the
Supabase project referenced by `SUPABASE_URL`. This is a one-time manual step
performed by the repository owner; it is not automated by this plan.

### Success Criteria

#### Automated Verification

- `npm run lint` passes after editing `ci.yml` (YAML is valid; no ESLint
  violations in workflow file).
- CI YAML is structurally valid: `act` dry-run or GitHub Actions workflow
  linter reports no errors (optional local check).

#### Manual Verification

- Push branch to GitHub; open a PR; observe `e2e-smoke` job appears in the
  Checks section.
- With both new secrets set in repository settings, the job passes (green
  checkmark).
- Remove `TEST_USER_EMAIL` secret temporarily; confirm the job fails with a
  meaningful error (not a silent pass).

**Implementation Note**: The `e2e-smoke` job will fail until `TEST_USER_EMAIL`
and `TEST_USER_PASSWORD` are added as repository secrets. This is expected and
acceptable during rollout. Pause here for manual confirmation that both secrets
are set and the job passes.

---

## Testing Strategy

### Unit Tests

None — smoke tests are integration/e2e by nature; no unit test additions
needed in this change.

### Integration Tests

None — existing Vitest integration tests remain unchanged.

### Manual Testing Steps

1. Create `.env.test` with real credentials for a local or cloud Supabase
   account.
2. Run `npm run test:e2e`; both tests should be green.
3. Open a PR; verify the `e2e-smoke` GitHub Actions job runs and passes
   (requires secrets to be set first).
4. Temporarily break auth (e.g., pass wrong password via secret) and verify
   the job turns red.

## Performance Considerations

`npx playwright install --with-deps chromium` downloads ~150 MB in CI. The
full smoke run (2 tests, 1 browser) takes ~20-30 s including dev server start.
This is acceptable overhead for a blocking PR gate.

If startup time becomes an issue, `webServer.reuseExistingServer: true` already
avoids redundant restarts within a single run.

## Migration Notes

No data migration. The test user must be manually created once in the Supabase
project (local for local runs, cloud for CI). This is documented in
`.env.test.example`.

## References

- Test plan: `context/foundation/test-plan.md` §7 (e2e excluded from phases
  1-3; this change adds it as Phase 4 equivalent)
- Middleware: `src/middleware.ts` — PROTECTED_ROUTES source
- Sign-in form: `src/components/auth/SignInForm.tsx:43` — form action and
  field ids
- Playwright config: `playwright.config.ts` (updated in Phase 1)

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a
> step lands. Do not rename step titles.

### Phase 1: Playwright config & env scaffolding

#### Automated

- [x] 1.1 `npm install -D dotenv` completes; dotenv in devDependencies
- [ ] 1.2 `npx playwright test --list` exits 0 (after Phase 2 test file lands)
- [x] 1.3 `npm run lint` passes after config changes

#### Manual

- [x] 1.4 `.gitignore` shows `.env.test` in env section
- [x] 1.5 `.env.test.example` shows both variable names with empty values

### Phase 2: Smoke test file

#### Automated

- [ ] 2.1 `npx playwright test --list` shows exactly 2 tests in smoke.spec.ts
- [ ] 2.2 `npm run test:e2e` exits 0 with valid `.env.test`
- [ ] 2.3 Test 1 (redirect guard) passes with no credentials in `.env.test`

#### Manual

- [ ] 2.4 Both tests pass in Playwright terminal output with real credentials
- [ ] 2.5 Wrong password causes test 2 to fail with clear error message

### Phase 3: CI integration

#### Automated

- [ ] 3.1 `npm run lint` passes after ci.yml edit

#### Manual

- [ ] 3.2 `e2e-smoke` job appears in GitHub Actions on a PR
- [ ] 3.3 Job passes with `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` secrets set
- [ ] 3.4 Job fails when `TEST_USER_EMAIL` secret is absent
