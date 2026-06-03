-- habits
CREATE TABLE habits (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  frequency  smallint    NOT NULL CHECK (frequency >= 1 AND frequency <= 7),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- completions
CREATE TABLE completions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id     uuid        NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_on date        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT completions_habit_date_unique UNIQUE (habit_id, completed_on)
);

-- Composite index for rolling-window queries (FR-007)
CREATE INDEX idx_completions_habit_date ON completions(habit_id, completed_on DESC);

-- RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

-- habits policies
CREATE POLICY "habits_select_own"  ON habits FOR SELECT USING        (user_id = auth.uid());
CREATE POLICY "habits_insert_own"  ON habits FOR INSERT WITH CHECK   (user_id = auth.uid());
CREATE POLICY "habits_update_own"  ON habits FOR UPDATE USING        (user_id = auth.uid())
                                              WITH CHECK              (user_id = auth.uid());
CREATE POLICY "habits_delete_own"  ON habits FOR DELETE USING        (user_id = auth.uid());

-- completions policies
CREATE POLICY "completions_select_own" ON completions FOR SELECT USING        (user_id = auth.uid());
CREATE POLICY "completions_insert_own" ON completions FOR INSERT WITH CHECK   (user_id = auth.uid());
CREATE POLICY "completions_update_own" ON completions FOR UPDATE USING        (user_id = auth.uid())
                                                       WITH CHECK              (user_id = auth.uid());
CREATE POLICY "completions_delete_own" ON completions FOR DELETE USING        (user_id = auth.uid());
