-- Seed script for testing adaptive recommendation (S-03)
-- Run with: npx supabase db execute --local --file scripts/seed-recommendations.sql
--
-- Context (as of 2026-06-05, Friday):
--   Last complete week : Mon 2026-05-25 – Sun 2026-05-31
--   Week before        : Mon 2026-05-18 – Sun 2026-05-24
--   Week before that   : Mon 2026-05-11 – Sun 2026-05-17
--
-- Scenarios created:
--   [SEED] Lower goal    → frequency=3, completed 1×  last week  → "lower" recommendation
--   [SEED] Raise goal    → frequency=2, completed 5×  last week  → "raise" recommendation
--   [SEED] Maintain      → frequency=3, completed 3×  last week  → "maintain" recommendation
--   [SEED] Floor (min=1) → frequency=1, completed 0×  last week  → "maintain" (floor note)
--   [SEED] New habit     → created 2026-06-02, < 2 full weeks    → "insufficient_data" countdown
--   [SEED] Dismissed     → "lower" recommendation but dismissed   → suppressed (won't show)

DO $$
DECLARE
  v_user_id uuid;
  h_lower   uuid := gen_random_uuid();
  h_raise   uuid := gen_random_uuid();
  h_maintain uuid := gen_random_uuid();
  h_floor   uuid := gen_random_uuid();
  h_new     uuid := gen_random_uuid();
  h_dismissed uuid := gen_random_uuid();
BEGIN
  -- Pick the first registered user
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found — sign up at least once first, then re-run this script.';
  END IF;

  -- ── Clean up previous seed runs ──────────────────────────────────────────
  DELETE FROM completions
    WHERE habit_id IN (
      SELECT id FROM habits WHERE user_id = v_user_id AND name LIKE '[SEED]%'
    );
  DELETE FROM habits WHERE user_id = v_user_id AND name LIKE '[SEED]%';

  -- ── Insert habits ─────────────────────────────────────────────────────────
  INSERT INTO habits (id, user_id, name, frequency, created_at)
  VALUES
    -- old enough that all 3 completed weeks are "available"
    (h_lower,    v_user_id, '[SEED] Lower goal',    3, '2026-05-01T00:00:00Z'),
    (h_raise,    v_user_id, '[SEED] Raise goal',    2, '2026-05-01T00:00:00Z'),
    (h_maintain, v_user_id, '[SEED] Maintain',      3, '2026-05-01T00:00:00Z'),
    (h_floor,    v_user_id, '[SEED] Floor (min=1)', 1, '2026-05-01T00:00:00Z'),
    -- created this week → only current (incomplete) week exists → insufficient_data
    (h_new,      v_user_id, '[SEED] New habit',     2, '2026-06-02T00:00:00Z'),
    -- old habit with dismissal timestamp (no completions after it) → suppressed
    (h_dismissed, v_user_id, '[SEED] Dismissed',   3, '2026-05-01T00:00:00Z');

  -- Set dismissed_at on the dismissed habit (timestamp before any completions we'll add)
  UPDATE habits
    SET recommendation_dismissed_at = '2026-05-30T12:00:00Z'
    WHERE id = h_dismissed;

  -- ── Insert completions for last complete week (2026-05-25 to 2026-05-31) ─

  -- [SEED] Lower goal: target=3, completed=1 → LOWER recommendation
  INSERT INTO completions (habit_id, user_id, completed_on, created_at) VALUES
    (h_lower, v_user_id, '2026-05-26', '2026-05-26T09:00:00Z');

  -- [SEED] Raise goal: target=2, completed=5 → RAISE recommendation
  INSERT INTO completions (habit_id, user_id, completed_on, created_at) VALUES
    (h_raise, v_user_id, '2026-05-25', '2026-05-25T09:00:00Z'),
    (h_raise, v_user_id, '2026-05-26', '2026-05-26T09:00:00Z'),
    (h_raise, v_user_id, '2026-05-27', '2026-05-27T09:00:00Z'),
    (h_raise, v_user_id, '2026-05-28', '2026-05-28T09:00:00Z'),
    (h_raise, v_user_id, '2026-05-29', '2026-05-29T09:00:00Z');

  -- [SEED] Maintain: target=3, completed=3 → MAINTAIN
  INSERT INTO completions (habit_id, user_id, completed_on, created_at) VALUES
    (h_maintain, v_user_id, '2026-05-26', '2026-05-26T09:00:00Z'),
    (h_maintain, v_user_id, '2026-05-27', '2026-05-27T09:00:00Z'),
    (h_maintain, v_user_id, '2026-05-28', '2026-05-28T09:00:00Z');

  -- [SEED] Floor (min=1): target=1, completed=0 → MAINTAIN with floor note
  -- (no completions inserted)

  -- [SEED] New habit: no completions needed (insufficient_data fires on habit age alone)

  -- [SEED] Dismissed: target=3, completed=1 last week, dismissed_at before completions
  -- dismissed_at = 2026-05-30T12:00:00Z; completion on May 26 (before dismissed_at)
  -- → suppressed=true (no completion created_at > dismissed_at)
  INSERT INTO completions (habit_id, user_id, completed_on, created_at) VALUES
    (h_dismissed, v_user_id, '2026-05-26', '2026-05-26T09:00:00Z');

  RAISE NOTICE 'Seed complete for user %', v_user_id;
  RAISE NOTICE '  [SEED] Lower goal    → expect: lower  (completed 1 of 3)';
  RAISE NOTICE '  [SEED] Raise goal    → expect: raise  (completed 5 of 2)';
  RAISE NOTICE '  [SEED] Maintain      → expect: maintain (completed 3 of 3)';
  RAISE NOTICE '  [SEED] Floor (min=1) → expect: maintain with floor note (0 completions, freq=1)';
  RAISE NOTICE '  [SEED] New habit     → expect: insufficient_data / countdown';
  RAISE NOTICE '  [SEED] Dismissed     → expect: lower but suppressed (no button shown)';
END $$;
