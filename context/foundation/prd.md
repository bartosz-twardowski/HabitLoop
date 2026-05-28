---
project: "HabitLoop"
version: 1
status: draft
created: 2026-05-28
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: false
---

## Vision & Problem Statement

Habit trackers that lock users to a fixed weekly target punish inconsistency. When a working adult misses several days, the tracker's deficit counter grows — and the accumulated sense of failure drives them to abandon the habit entirely, not recover from it. The tool designed to help becomes a source of shame.

The product insight: a rolling 2–3 week completion rate is a more honest measure of sustainable capacity than a streak count. An adaptive rule that adjusts the goal downward after a run of failures — and upward after a run of successes — keeps the habit alive rather than punishing the user into quitting.

## User & Persona

**Primary persona:** A working adult building side-goal habits (running, reading, language practice). Their schedule is fragmented — a demanding job means available time is inconsistent week to week. They've tried habit apps before and quit when a bad stretch turned the tracker from motivational to accusatory. They know what they want to do; they need a tool that meets them at their actual capacity rather than demanding they meet a fixed standard.

## Success Criteria

### Primary
- A user who has never seen the app can complete the full flow — create a habit, check off completions, and receive a correctly-computed adaptive recommendation — without instructions or onboarding help.
- The adaptive rule fires correctly in both directions: recommends lowering the goal after a defined run of failures AND raising it after a defined run of successes.

### Secondary
- A user can track more than one habit simultaneously, each with its own independent adaptive rule.

### Guardrails
- A user's habit data and completion history are never visible to any other user under any circumstances.

## User Stories

### US-01: User receives an adaptive recommendation

- **Given** a logged-in user who has a habit with at least 2 weeks of completion data
- **When** they open their habit dashboard
- **Then** the app displays the current completion rate for the rolling window alongside one of three adaptive outputs — lower the goal (run of failures), raise the goal (run of successes), or maintain (user is hitting their target) — with a plain-language explanation of why

#### Acceptance Criteria
- The adaptive output fires automatically on the dashboard; user does not need to request it
- No adaptive output is shown when fewer than 2 weeks of data exist for a habit; the UI communicates when tracking will begin to produce a recommendation (e.g. "First recommendation in N days")
- The explanation names the cause (e.g. "You completed 1 of 3 target runs last week and 1 of 3 the week before")
- The "maintain" output displays a confirmation, not silence (e.g. "You're hitting your goal — keep it up")
- A "lower" recommendation never suggests fewer than 1×/week; when the current goal is already 1×/week and the failure pattern holds, the output is "maintain" with a note that the goal is already at its minimum
- The user can accept or dismiss a "lower" or "raise" recommendation (FR-009); "maintain" is informational only and requires no action

---

### US-02: User completes the first-time setup flow

- **Given** a visitor who has not yet created an account
- **When** they sign up with an email and password and create their first habit
- **Then** they can immediately begin logging completions

#### Acceptance Criteria
- Sign-up requires only email and password (no profile questions, no onboarding wizard)
- First habit creation requires only: habit name and target frequency (e.g. "3×/week")
- User lands on their habit dashboard after creating the first habit

## Functional Requirements

### Authentication

- FR-001: A visitor can create an account with an email address and password. Priority: must-have
  > Socrates: Counter-argument considered: "Auth is the hardest part to get right; ship without it first (local profile)." Resolution: kept — auth is load-bearing; without it, user data cannot be private by default, which is a guardrail.
- FR-002: A registered user can sign in with their email and password. Priority: must-have
- FR-003: A signed-in user can sign out. Priority: must-have

### Habits

- FR-004: A signed-in user can create a habit with a name and a target frequency expressed as a whole number of times per week (e.g. "3×/week"; minimum 1×/week, maximum 7×/week). Priority: must-have
  > Socrates: Counter-argument considered: "Let the user just log completions; infer a goal from early behavior." Resolution: kept — without an explicit target frequency, 'failure' and 'success' are undefined, and the adaptive rule cannot compute anything.
  > Scope decision: frequency unit constrained to N×/week only. Sub-weekly (monthly, fortnightly) and multi-daily frequencies are out of MVP scope — they require different rolling-window semantics than the 2-week window this rule assumes.
- FR-005: A signed-in user can record a completion for a habit on a specific day (including past days). Priority: must-have
  > Socrates: Counter-argument considered: "Backdating makes the rolling window gameable." Resolution: kept — gaming only affects the user's own recommendations; it is not a product integrity problem at MVP scope. Accurate historical data matters more than preventing self-gaming.
- FR-006: A signed-in user can view their completion history for a habit. Priority: must-have
  > Socrates: Counter-argument considered: "A raw count ('5 of 9 target days') is enough for MVP instead of a full history view." Resolution: kept as must-have, but scope is intentionally minimal — a simple count or log is sufficient; a full calendar or graph view is out of MVP scope.
- FR-010: A signed-in user can view a list of all their habits and navigate to any individual habit's detail view. Priority: must-have

### Adaptive Rule

- FR-007: The app evaluates a signed-in user's completion rate for each habit over a rolling 2–3 week window and computes an adaptive recommendation (lower goal / raise goal / maintain). Priority: must-have
  > Socrates: Counter-argument considered: "2–3 weeks is too slow; the user quits before the rule fires." Resolution: kept — the rolling window is the core product insight. The design must set the expectation at habit creation (e.g. "You'll receive your first recommendation after 2 weeks of tracking").
- FR-008: The app displays the adaptive recommendation with a plain-language explanation of the reason. Priority: must-have
- FR-009: A signed-in user can accept or dismiss the adaptive recommendation to explicitly update their goal. Priority: must-have

## Non-Functional Requirements

- Any user action (check-off, login, habit creation) produces a visible acknowledgement within 200 ms as perceived in a mainstream desktop browser. The adaptive recommendation may appear after a short additional delay; if computation takes longer than 2 seconds, the user sees continuous visible progress rather than a frozen screen.
- The product remains usable on the latest two major versions of Chrome, Firefox, Safari, and Edge.
- The adaptive recommendation and its explanation are written in plain language — no statistical terms, percentages, or jargon visible to the user.
- A user's completion history is retained for the lifetime of their account; history loss would break the rolling window rule.
- One user's habit data and completion history are never visible or accessible to any other user.

## Business Logic

The app adjusts a habit's target frequency by comparing the user's completion rate in the most recent 2–3 week rolling window against the current goal — recommending a lower target after a defined run of shortfalls and a higher target after a defined run of successes.

The rule consumes two user-facing inputs: the logged completions for the habit (each check-off the user records, with its date), and the current target frequency (set at habit creation, e.g. "3×/week"). The window size (number of weeks evaluated) and the run-length threshold (how many consecutive under- or over-performing weeks trigger a recommendation) are product-defined constants for the MVP — not user-configurable.

The rule produces one of three outputs: lower the goal (user's completion rate has been below target for a sustained run), maintain (user is hitting their goal), or raise the goal (completion rate has been above target for a sustained run). The output is surfaced to the user as a recommendation with a plain-language explanation. The goal updates only when the user explicitly accepts the recommendation (FR-009); it never changes silently. The minimum goal is 1×/week — when the goal is already at that floor and a failure pattern persists, the rule outputs "maintain" with a note that the floor has been reached.

Target frequency is expressed exclusively as a whole number of times per week (N×/week, where 1 ≤ N ≤ 7). Sub-weekly or multi-daily frequency units are not supported in MVP.

# TODO: rolling window size and run-length threshold values — see Open Questions (blocking)

## Access Control

Sign-up and sign-in via email and password. Each account is private — habits and execution history are visible only to the authenticated user who created them. No sharing, no social layer. An unauthenticated visitor who reaches any gated route is redirected to the sign-in page.

# TODO: flat vs. admin user model — see Open Questions

## Non-Goals

- **No push notifications or reminders.** Users must open the app to log completions and see recommendations. Notifications add platform and infrastructure complexity not justified in MVP.
- **No mobile app.** Web-only for the MVP. The adaptive rule and tracking flow work in a desktop browser; a native mobile app is a distinct product surface for a later version.
- **No social features.** No sharing, comparisons, leaderboards, or public profiles. Habits are private by default; the product does not incentivize social performance.
- **No gamification.** No streaks, badges, points, or reward mechanics. The adaptive goal recommendation is the engagement mechanism; streaks are explicitly the anti-pattern this product addresses.
- **No habit editing or deletion.** A user cannot rename a habit or delete it in MVP. The core loop (create → track → adapt) does not require these operations, and their absence avoids the question of what happens to completion history on delete. Planned for v2.

## Open Questions

1. **What are the specific values for the rolling window size and run-length threshold?** E.g. "2-week window; 2 consecutive under-performing weeks triggers a lower recommendation." These are domain decisions that define when the rule fires. Block: yes — the adaptive rule cannot be implemented without them. Owner: user. By: before implementation.
2. **Is a flat user model (every user equal, no admin) sufficient for MVP?** Or is an admin role needed to manage accounts (e.g. reset passwords, delete users)? Likely flat for MVP. Owner: user. By: before PRD lock.
