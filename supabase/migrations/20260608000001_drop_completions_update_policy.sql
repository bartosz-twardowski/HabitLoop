-- Completions are factual append-only records (habit X completed on date Y).
-- No product requirement exists for editing completions; only insert + delete (undo).
-- Dropping the UPDATE policy reduces the mutation surface.
DROP POLICY "completions_update_own" ON completions;
