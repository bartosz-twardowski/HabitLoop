---
project: HabitLoop
version: 1
status: draft
created: 2026-05-30
updated: 2026-06-03
prd_version: 1
main_goal: speed
top_blocker: decisions
---

# Roadmap: HabitLoop

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Habit trackers that punish inconsistency push users to quit. HabitLoop takes a different approach: instead of a fixed weekly target and a shame-inducing streak counter, it tracks a rolling completion rate over 2–3 weeks — a window of recent history used to assess sustainable capacity — and automatically recommends adjusting the goal: down after a run of failures, up after a run of successes. The product's distinguishing trait is that the goal adapts to the user's actual capacity rather than demanding they meet a fixed standard.

## North star

**S-03: użytkownik widzi adaptacyjną rekomendację i akceptuje lub odrzuca ją** — najmniejszy flow end-to-end, który udowadnia, że rdzeń produktu działa: reguła adaptacyjna oblicza rekomendację, wyświetla ją z prostym wyjaśnieniem i pozwala użytkownikowi zaakceptować lub odrzucić zmianę celu.

> "North star" w tym dokumencie oznacza: najmniejszy end-to-end slice, którego dostarczenie udowadnia centralną hipotezę produktu — umieszczony jak najwcześniej w kolejce, bo wszystko inne ma sens dopiero gdy to działa.

## At a glance

| ID   | Change ID                  | Outcome (user can …)                                             | Prerequisites | PRD refs                                      | Status   |
| ---- | -------------------------- | ---------------------------------------------------------------- | ------------- | --------------------------------------------- | -------- |
| F-01 | data-schema                | (foundation) tabele habits + completions z RLS gotowe do użycia  | —             | FR-004, FR-005, FR-007                        | ready    |
| S-01 | habit-creation-dashboard   | stworzyć nawyk i zobaczyć jego listę na dashboardzie             | F-01          | FR-001, FR-002, FR-003, FR-004, FR-010, US-02 | done     |
| S-02 | completion-logging-history | zalogować ukończenie nawyku i zobaczyć historię ukończeń         | S-01          | FR-005, FR-006, US-02                         | proposed |
| S-03 | adaptive-recommendation    | zobaczyć adaptacyjną rekomendację i zaakceptować lub odrzucić ją | S-01, S-02    | FR-007, FR-008, FR-009, US-01                 | blocked  |

## Baseline

Stan kodu na dzień 2026-05-30 (auto-zbadany, bez korekt użytkownika).
Foundations poniżej zakładają, że te warstwy są obecne i ich **nie** przebudowują.

- **Frontend:** present — Astro 6.3.1 + React 19 + Tailwind v4 (vite plugin); `src/components/auth/SignInForm.tsx`, `src/components/ui/button.tsx`, `src/components/Banner.astro`
- **Backend / API:** partial — trasy auth (`src/pages/api/auth/`: signin, signup, signout) + middleware; brak tras dla nawyków
- **Data:** partial — klient Supabase (`src/lib/supabase.ts`); brak tabel custom, brak migracji (`supabase/config.toml`: `schema_paths = []`)
- **Auth:** present — Supabase + `src/middleware.ts` (ochrona `/dashboard`, `supabase.auth.getUser()`) + API routes auth w pełni obecne
- **Deploy / infra:** present — Netlify adapter w `astro.config.mjs:16`; CI/CD w `.github/workflows/ci.yml`
- **Observability:** absent — brak logowania, error trackingu, metryk

## Foundations

### F-01: Schemat danych

- **Outcome:** (foundation) tabele `habits` i `completions` z politykami RLS w Supabase; każdy użytkownik widzi wyłącznie swoje dane; schemat gotowy do użycia przez trasy API nawyków.
- **Change ID:** `data-schema`
- **PRD refs:** FR-004 (potrzebna tabela habits z kolumną frequency), FR-005 (potrzebna tabela completions z kolumną date), FR-007 (completions agregowane przez regułę adaptacyjną), Guardrail — dane prywatne per użytkownik (wymaga RLS)
- **Unlocks:** S-01 (habit creation wymaga tabeli habits), S-02 (logowanie wymaga tabeli completions), S-03 (reguła adaptacyjna odpytuje completions)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Błąd w projekcie schematu (np. brak RLS, nieprawidłowy typ kolumny frequency, brakująca relacja FK) wymusi migrację korygującą w środku późniejszego slice. Bezpieczniej zaprojektować pełny schemat tutaj, zanim trasy API zaczną z niego korzystać.
- **Status:** ready

## Slices

### S-01: Tworzenie nawyku i lista na dashboardzie

- **Outcome:** użytkownik może stworzyć nawyk z nazwą i częstotliwością tygodniową oraz zobaczyć listę swoich nawyków na dashboardzie i przejść do widoku szczegółów dowolnego nawyku
- **Change ID:** `habit-creation-dashboard`
- **PRD refs:** FR-001, FR-002, FR-003 (flow auth wymagany do wejścia na dashboard — present w baseline), FR-004 (tworzenie nawyku), FR-010 (lista nawyków + nawigacja do widoku szczegółów), US-02
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Strony UI dla sign-up i sign-in mogą wymagać drobnych uzupełnień (komponent `SignInForm.tsx` istnieje, ale powiązane strony `.astro` mogą być niekompletne); zakres do odkrycia przez `/10x-plan`.
- **Status:** done

### S-02: Logowanie ukończeń i historia nawyku

- **Outcome:** użytkownik może zaznaczyć ukończenie nawyku na wybrany dzień (w tym przeszłe) oraz zobaczyć historię swoich ukończeń w widoku szczegółów nawyku
- **Change ID:** `completion-logging-history`
- **PRD refs:** FR-005 (logowanie ukończeń, w tym backdating), FR-006 (historia ukończeń — minimalna: log lub licznik), US-02 (użytkownik może natychmiast zacząć logować ukończenia po setup)
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Logowanie z backdatowaniem (FR-005) wymaga walidacji daty — przekazanie niepoprawnej daty nie może zaburzyć okna historycznego, z którego korzysta reguła adaptacyjna w S-03.
- **Status:** proposed

### S-03: Adaptacyjna rekomendacja

- **Outcome:** użytkownik może zobaczyć na dashboardzie obliczoną rekomendację adaptacyjną (obniż / utrzymaj / podnieś cel) z prostym wyjaśnieniem przyczyny oraz zaakceptować lub odrzucić sugerowaną zmianę celu
- **Change ID:** `adaptive-recommendation`
- **PRD refs:** FR-007 (obliczanie rekomendacji w rolling window), FR-008 (wyświetlanie z wyjaśnieniem w prostym języku), FR-009 (akceptacja/odrzucenie rekomendacji), US-01
- **Prerequisites:** S-01, S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jakie są konkretne wartości dla rozmiaru okna rolling window i progu run-length (ile kolejnych tygodni poniżej/powyżej celu odpala rekomendację)? Np. "okno 2-tygodniowe; 2 kolejne tygodnie poniżej celu = rekomendacja 'obniż'." — Owner: user. Block: yes.
- **Risk:** Reguła adaptacyjna jest algorytmicznie prosta po ustaleniu stałych, ale wymaga pokrycia edge-cases: cel już na minimum 1×/week, brak 2 tygodni danych (brak rekomendacji), stan "maintain" musi wyświetlić potwierdzenie (nie ciszę). Bez stałych implementacja nie może ruszyć.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                  | Suggested issue title                                             | Ready for `/10x-plan` | Notes                                              |
| ---------- | -------------------------- | ----------------------------------------------------------------- | --------------------- | -------------------------------------------------- |
| F-01       | data-schema                | [HabitLoop] Schemat danych: tabele habits + completions z RLS     | yes                   | Run `/10x-plan data-schema`                        |
| S-01       | habit-creation-dashboard   | [HabitLoop] Tworzenie nawyku i lista na dashboardzie              | no                    | Wymaga F-01; gotowe do planowania po F-01          |
| S-02       | completion-logging-history | [HabitLoop] Logowanie ukończeń i historia nawyku                  | no                    | Wymaga S-01                                        |
| S-03       | adaptive-recommendation    | [HabitLoop] Adaptacyjna rekomendacja (obniż / utrzymaj / podnieś) | no                    | Zablokowane — ustal window size + run-length (OQ1) |

## Open Roadmap Questions

1. **Jakie są konkretne wartości dla rozmiaru okna rolling window i progu run-length?** Np. "okno 2-tygodniowe; 2 kolejne tygodnie poniżej celu odpala rekomendację 'obniż'." To decyzja domenowa, która definiuje kiedy reguła się odpala. — Owner: user. Block: S-03 (reguła adaptacyjna nie może być zaimplementowana bez tych stałych).
2. **Czy płaski model użytkowników (każdy równy, brak admina) wystarczy na MVP?** Czy potrzebna rola admin do zarządzania kontami (reset haseł, usuwanie użytkowników)? Prawdopodobnie flat. — Owner: user. Block: nie blokuje żadnego slice.

## Parked

- **Push notifications / przypomnienia** — Why parked: PRD §Non-Goals; dodaje złożoność platformową (uprawnienia, harmonogram) nieuzasadnioną w MVP.
- **Aplikacja mobilna (native)** — Why parked: PRD §Non-Goals; web-only dla MVP; osobny produkt na późniejszy etap.
- **Funkcje społecznościowe** — Why parked: PRD §Non-Goals; brak udostępniania, porównywania, publicznych profili; nawyki są prywatne by design.
- **Gamifikacja (streaki, odznaki, punkty)** — Why parked: PRD §Non-Goals; adaptacyjna rekomendacja to mechanizm zaangażowania; streaki to anty-wzorzec, który ten produkt adresuje.
- **Edytowanie i usuwanie nawyków** — Why parked: PRD §Non-Goals; planowane v2; brak edycji/usuwania upraszcza pytanie o historię przy usunięciu.
- **Observability (logowanie, error tracking, metryki)** — Why parked: baseline absent; nie blokuje MVP z małym user base; zalecane przed pierwszym zewnętrznym użytkownikiem.

## Done

- **S-01: użytkownik może stworzyć nawyk z nazwą i częstotliwością tygodniową oraz zobaczyć listę swoich nawyków na dashboardzie i przejść do widoku szczegółów dowolnego nawyku** — Archived 2026-06-03 → `context/archive/2026-06-03-habit-creation-dashboard/`. Lesson: —.
