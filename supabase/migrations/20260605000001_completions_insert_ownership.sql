-- Fix completions_insert_own RLS policy to also verify habit ownership (L-001).
-- The previous policy only checked user_id = auth.uid(), allowing a user who
-- obtained another user's habit UUID to insert completions against that habit.

DROP POLICY IF EXISTS "completions_insert_own" ON completions;

CREATE POLICY "completions_insert_own" ON completions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM habits WHERE habits.id = completions.habit_id AND habits.user_id = auth.uid()
  )
);
