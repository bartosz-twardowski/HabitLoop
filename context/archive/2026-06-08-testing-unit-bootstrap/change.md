---
change_id: testing-unit-bootstrap
title: Unit test bootstrap for adaptive recommendations and API validation
status: archived
created: 2026-06-08
updated: 2026-06-09
archived_at: 2026-06-09T07:38:00Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Unit test bootstrap". Risks covered: #1 (adaptive recommendation produces wrong output), #5 (API accepts invalid frequency/date). Test types planned: unit. Risk response intent: Risk #1 — prove the rolling window function returns correct lower/maintain/raise for hand-calculated input scenarios, exercising all three branches plus edge cases (floor, ceiling, insufficient data, partial week); Risk #5 — prove API rejects frequency outside 1-7 and malformed date strings at the handler level, not just the Zod schema in isolation. After creating the folder, follow the downstream continuation rule.
