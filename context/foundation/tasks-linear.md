# HabitLoop — Linear Backlog (sesja 2026-05-30)

> Podsumowanie sesji: import `context/foundation/roadmap.md` do Linear.

## Co zostało zrobione

Cały roadmap v1 przeniesiony do Linear workspace **Bartosz Twardowski** (team key: `BAR`).
Struktura: 1 projekt → 4 milestony → 4 issues z pełnymi opisami, priorytetami i zależnościami.

---

## Projekt

| Pole | Wartość |
|------|---------|
| Nazwa | HabitLoop |
| URL | https://linear.app/bartosz-twardowski/project/habitloop-17d9cc3158b1 |
| Team | Bartosz Twardowski (BAR) |
| Priorytet | High |
| Status | Backlog |

---

## Milestony

| Milestone | Roadmap ID | Change ID |
|-----------|------------|-----------|
| F-01: Schemat danych | F-01 | `data-schema` |
| S-01: Tworzenie nawyku i lista na dashboardzie | S-01 | `habit-creation-dashboard` |
| S-02: Logowanie ukończeń i historia nawyku | S-02 | `completion-logging-history` |
| S-03: Adaptacyjna rekomendacja ⭐ North Star | S-03 | `adaptive-recommendation` |

---

## Issues

### BAR-5 — F-01: Schemat danych

- **URL:** https://linear.app/bartosz-twardowski/issue/BAR-5/habitloop-f-01-schemat-danych-tabele-habits-completions-z-rls
- **Status:** Todo
- **Priorytet:** Urgent
- **Milestone:** F-01: Schemat danych
- **Zależności:** brak (punkt startowy)
- **Blokuje:** BAR-6, BAR-7, BAR-8
- **Ready for `/10x-plan`:** ✅ tak — `run /10x-plan data-schema`
- **Kluczowe info:** Migracje Supabase dla tabel `habits` i `completions` z politykami RLS. Brak migracji w baseline (`schema_paths = []`).

---

### BAR-6 — S-01: Tworzenie nawyku i lista na dashboardzie

- **URL:** https://linear.app/bartosz-twardowski/issue/BAR-6/habitloop-s-01-tworzenie-nawyku-i-lista-na-dashboardzie
- **Status:** Backlog
- **Priorytet:** High
- **Milestone:** S-01: Tworzenie nawyku i lista na dashboardzie
- **Zależności:** BAR-5 musi być ukończone
- **Blokuje:** BAR-7, BAR-8
- **Ready for `/10x-plan`:** ⏳ po ukończeniu BAR-5
- **Kluczowe info:** Formularz tworzenia nawyku (nazwa + częstotliwość/tydzień), lista nawyków na dashboardzie, nawigacja do widoku szczegółów. Strony `.astro` dla auth mogą wymagać uzupełnienia.

---

### BAR-7 — S-02: Logowanie ukończeń i historia nawyku

- **URL:** https://linear.app/bartosz-twardowski/issue/BAR-7/habitloop-s-02-logowanie-ukonczen-i-historia-nawyku
- **Status:** Backlog
- **Priorytet:** High
- **Milestone:** S-02: Logowanie ukończeń i historia nawyku
- **Zależności:** BAR-6 musi być ukończone
- **Blokuje:** BAR-8
- **Ready for `/10x-plan`:** ⏳ po ukończeniu BAR-6
- **Kluczowe info:** Logowanie ukończenia na dowolny dzień (backdating), historia ukończeń w widoku szczegółów. Walidacja daty krytyczna — błędna data może zaburzyć okno rolling window w S-03.

---

### BAR-8 — S-03: Adaptacyjna rekomendacja

- **URL:** https://linear.app/bartosz-twardowski/issue/BAR-8/habitloop-s-03-adaptacyjna-rekomendacja-obniz-utrzymaj-podnies
- **Status:** Backlog
- **Priorytet:** High
- **Milestone:** S-03: Adaptacyjna rekomendacja ⭐ North Star
- **Zależności:** BAR-6 + BAR-7 muszą być ukończone
- **Blokuje:** —
- **Ready for `/10x-plan`:** 🚫 zablokowane — patrz OQ1 poniżej
- **Kluczowe info:** Obliczenie rekomendacji (obniż/utrzymaj/podnieś), wyświetlenie z wyjaśnieniem, akceptacja/odrzucenie przez użytkownika.

---

## Open Questions

### OQ1 — Rolling window i run-length (blokuje BAR-8)

**Pytanie:** Jakie są konkretne wartości dla rozmiaru okna rolling window i progu run-length?

Przykład: "okno 2-tygodniowe; 2 kolejne tygodnie poniżej celu = rekomendacja 'obniż'."

- **Owner:** user
- **Blokuje:** BAR-8 (S-03 nie może być zaplanowane bez tych stałych)
- **Jak odblokować:** Użytkownik decyduje o wartościach → zaktualizuj BAR-8 i uruchom `/10x-plan adaptive-recommendation`

### OQ2 — Flat model użytkowników (nie blokuje)

**Pytanie:** Czy płaski model użytkowników (brak admina) wystarczy na MVP?

- **Owner:** user
- **Blokuje:** nic — nie wstrzymuje żadnego slice

---

## Kolejność pracy

```
BAR-5 (F-01) → BAR-6 (S-01) → BAR-7 (S-02) → BAR-8 (S-03)
```

Każdy krok sekwencyjny. Równoległość niedostępna — każdy slice zależy od poprzedniego.

**Następny krok:** `/10x-plan data-schema` (BAR-5)
