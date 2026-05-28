---
project: "HabitLoop"
context_type: greenfield
created: 2026-05-28
updated: 2026-05-28
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 9
  gray_areas_resolved:
    - topic: "primary persona"
      decision: "Working adult building side-goal habits (fitness, learning, writing); time is scarce and inconsistent"
    - topic: "product insight"
      decision: "Rolling window (2–3 week completion rate) is a more honest signal than streak counts; it reflects sustainable capacity, not a lucky run"
    - topic: "auth model"
      decision: "Email + password login; private habits per account; accessible from any browser"
    - topic: "user roles"
      decision: "Not decided — open question for PRD; likely flat user model"
  quality_check_status: accepted
---

## Vision & Problem Statement

Habit trackers that lock users to a fixed weekly target punish inconsistency. When a working adult misses several days, the tracker's deficit counter grows — and the accumulated sense of failure drives them to abandon the habit entirely, not recover from it. The tool designed to help becomes a source of shame.

The product insight: a rolling 2–3 week completion rate is a more honest measure of sustainable capacity than a streak count. An adaptive rule that adjusts the goal downward after a run of failures — and upward after a run of successes — keeps the habit alive rather than punishing the user into quitting.

## User & Persona

**Primary persona:** A working adult building side-goal habits (running, reading, language practice). Their schedule is fragmented — a demanding job means available time is inconsistent week to week. They've tried habit apps before and quit when a bad stretch turned the tracker from motivational to accusatory. They know what they want to do; they need a tool that meets them at their actual capacity rather than demanding they meet a fixed standard.

## Access Control

Sign-up and sign-in via email + password. Each account is private — habits and execution history are visible only to the authenticated user who created them. No sharing, no social layer.

**Open question:** Whether a flat model (every user equal) is sufficient or whether an admin role is needed to manage accounts. Likely flat for MVP — record in Open Questions.

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
- **Then** the app displays the current completion rate for the rolling window alongside an adaptive recommendation — either to lower the frequency goal (after a run of failures) or raise it (after a run of successes) — with a plain-language explanation of why

#### Acceptance Criteria
- Recommendation fires automatically; user does not need to request it
- The recommendation is never shown when fewer than 2 weeks of data exist for a habit
- The explanation names the cause (e.g. "You completed 1 of 3 target runs last week and 1 of 3 the week before")
- A recommendation to lower the goal never suggests fewer than 1 completion per period

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

- FR-004: A signed-in user can create a habit with a name and a target frequency (e.g. "3×/week"). Priority: must-have
  > Socrates: Counter-argument considered: "Let the user just log completions; infer a goal from early behavior." Resolution: kept — without an explicit target frequency, 'failure' and 'success' are undefined, and the adaptive rule cannot compute anything.
- FR-005: A signed-in user can record a completion for a habit on a specific day (including past days). Priority: must-have
  > Socrates: Counter-argument considered: "Backdating makes the rolling window gameable." Resolution: kept — gaming only affects the user's own recommendations; it's not a product integrity problem at MVP scope. Accurate historical data matters more than preventing self-gaming.
- FR-006: A signed-in user can view their completion history for a habit. Priority: must-have
  > Socrates: Counter-argument considered: "A raw count ('5 of 9 target days') is enough for MVP instead of a full history view." Resolution: kept as must-have, but scope is intentionally minimal — a simple count or log is sufficient; a full calendar or graph view is out of MVP scope.

### Adaptive Rule

- FR-007: The app evaluates a signed-in user's completion rate for each habit over a rolling 2–3 week window and computes an adaptive recommendation (lower goal / raise goal / maintain). Priority: must-have
  > Socrates: Counter-argument considered: "2–3 weeks is too slow; the user quits before the rule fires." Resolution: kept — the rolling window is the core product insight. The design must set the expectation at habit creation (e.g. "You'll receive your first recommendation after 2 weeks of tracking").
- FR-008: The app displays the adaptive recommendation with a plain-language explanation of the reason. Priority: must-have
  > Socrates: Counter-argument considered: "If accept/dismiss (FR-009) is nice-to-have, the explanation is just informational text." Resolution: kept — an explanation of a passive recommendation is still the honest and trustworthy design. The recommendation informs; it does not auto-change the goal.
- FR-009: A signed-in user can accept or dismiss the adaptive recommendation to explicitly update their goal. Priority: nice-to-have

## Business Logic

The app adjusts a habit's target frequency by comparing the user's completion rate in the most recent 2–3 week rolling window against the current goal — recommending a lower target after a defined run of shortfalls and a higher target after a defined run of successes.

The rule consumes two user-facing inputs: the logged completions for the habit (each check-off the user records, with its date), and the current target frequency (set at habit creation, e.g. "3×/week"). The window size (number of weeks evaluated) and the run-length threshold (how many consecutive under- or over-performing weeks trigger a recommendation) are product-defined constants for the MVP — not user-configurable.

The rule produces one of three outputs: lower the goal (user's completion rate has been below target for a sustained run), maintain (user is hitting their goal), or raise the goal (completion rate has been above target for a sustained run). The output is surfaced to the user as a recommendation with a plain-language explanation; it does not auto-update the goal without user awareness.

**Open question:** What are the specific values for the window size and run-length threshold? (e.g. 2 weeks window, 2 consecutive failures = lower recommendation.) These are domain decisions that must be defined before implementation. Record in Open Questions.

## Non-Functional Requirements

- A user's check-off, login, and dashboard load are acknowledged within 200 ms of the user's action as perceived in a mainstream desktop browser.
- The product remains usable on the latest two major versions of Chrome, Firefox, Safari, and Edge.
- The adaptive recommendation and its explanation are written in plain language — no statistical terms, percentages, or jargon visible to the user.
- A user's completion history is retained for the lifetime of their account; history loss would break the rolling window rule.
- One user's habit data and completion history are never visible or accessible to any other user.

## Non-Goals

- **No push notifications or reminders.** Users must open the app to log completions and see recommendations. Notifications add platform and infrastructure complexity not justified in MVP.
- **No mobile app.** Web-only for the MVP. The adaptive rule and tracking flow work in a desktop browser; a native mobile app is a distinct product surface for a later version.
- **No social features.** No sharing, comparisons, leaderboards, or public profiles. Habits are private by default; the product does not incentivize social performance.
- **No gamification.** No streaks, badges, points, or reward mechanics. The adaptive goal recommendation is the engagement mechanism; streaks are explicitly the anti-pattern this product addresses.

## Timeline Budget
- `product_type: web-app`
- `target_scale.users: small`
- `mvp_weeks: 3`
- `hard_deadline: null`
- `after_hours_only: false` (mix of day job and evenings)

## Open Questions

1. **What are the specific values for the rolling window size and run-length threshold?** E.g. "2-week window; 2 consecutive under-performing weeks triggers a lower recommendation." These are domain decisions that define when the rule fires. Block: yes — the adaptive rule cannot be implemented without them. Owner: user. By: before implementation.
2. **Is a flat user model (every user equal, no admin) sufficient for MVP?** Or is an admin role needed to manage accounts (e.g. reset passwords, delete users)? Likely flat for MVP. Owner: user. By: before PRD lock.

## Quality Cross-Check

All six greenfield elements present. No gaps. `quality_check_status: accepted` on 2026-05-28.
