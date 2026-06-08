---
change_id: data-schema
title: "Data Schema: habits + completions tables with RLS"
status: impl_reviewed
created: 2026-06-03
updated: 2026-06-08
roadmap_id: F-01
prd_refs: FR-004, FR-005, FR-007
unlocks: habit-creation-dashboard, completion-logging-history, adaptive-recommendation
---

Foundation change: create the `habits` and `completions` Postgres tables with RLS policies in Supabase, plus generated TypeScript database types. This is the prerequisite for all user-facing slices.
