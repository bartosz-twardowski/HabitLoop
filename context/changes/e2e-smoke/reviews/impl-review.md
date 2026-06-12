<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E2E Smoke Tests

- **Plan**: context/changes/e2e-smoke/plan.md
- **Scope**: All phases (1–3)
- **Date**: 2026-06-12
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical  2 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING → PASS (F1 fixed) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → PASS (F1, F2 fixed) |
| Architecture | PASS |
| Pattern Consistency | WARNING → PASS (F2 fixed) |
| Success Criteria | PASS |

## Findings

### F1 — keyboard.type() instead of .fill() dla credential input

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence + Safety & Quality
- **Location**: tests/e2e/smoke.spec.ts:17-20
- **Detail**: Plan zakładał .fill(), implementacja używała .click() + keyboard.type(). keyboard.type() ujawnia znaki hasła w Playwright trace artifacts. Również nieplanowane `{ exact: true }` na selektorze Password (nieszkodliwe).
- **Fix**: Zastąp click+keyboard.type przez .fill() na obu polach.
- **Decision**: FIXED — zmieniono na .fill(email) / .fill(password), zachowano { exact: true }

### F2 — throw new Error zamiast test.skip() dla brakujących credentials

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency + Reliability
- **Location**: tests/e2e/smoke.spec.ts:12-14
- **Detail**: Na fork PR GitHub Actions nie może przekazać secretów do jobów. throw powoduje FAILED (czerwony); test.skip() daje SKIPPED (żółty) i job przechodzi.
- **Fix**: Zastąp throw przez if (!email || !password) { test.skip(true, "..."); return; }
- **Decision**: FIXED via Fix A

### F3 — .env.test.example brakuje SUPABASE_URL i SUPABASE_KEY

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .env.test.example
- **Detail**: Template dokumentował tylko TEST_USER_EMAIL i TEST_USER_PASSWORD. Playwright uruchamia npm run dev przez webServer, który potrzebuje SUPABASE_URL i SUPABASE_KEY do startu.
- **Fix**: Dodaj SUPABASE_URL= i SUPABASE_KEY= (puste wartości, komentarz "local dev only — use repo secrets in CI").
- **Decision**: FIXED

### F4 — Brak eksplicytnego timeout na assert po sign-in

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: tests/e2e/smoke.spec.ts:22
- **Detail**: expect(page).toHaveURL("/dashboard") używał domyślnego 5 s timeout. Supabase auth redirect chain może trwać dłużej na wolnym CI runnerze.
- **Fix**: Dodaj { timeout: 10_000 } do toHaveURL.
- **Decision**: FIXED
