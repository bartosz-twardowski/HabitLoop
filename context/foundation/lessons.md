# Lessons

Recurring rules and pitfalls accepted by the team. Implementers and planners must read this file before starting any phase.

---

## L-001: Completions INSERT policy should verify habit ownership

**Rule:** The `completions_insert_own` RLS policy only checks `user_id = auth.uid()`. It does not verify that the referenced `habit_id` belongs to the inserting user. A user who somehow obtains another user's habit UUID can insert completion rows against that habit.

**Why:** `habits_select_own` blocks cross-user habit discovery and UUIDs are not guessable, so practical MVP risk is low. But once an API route exposes habit IDs to authenticated clients (S-01 onward), the attack surface becomes concrete — a malicious user could craft a POST with a guessed or harvested `habit_id`.

**How to apply:** When implementing any API route that inserts into `completions`, add a server-side ownership check before the insert (e.g. verify the habit belongs to `ctx.locals.user.id`). Before MVP graduates to multi-user scale, add the defense-in-depth sub-select to the policy itself:

```sql
CREATE POLICY "completions_insert_own" ON completions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM habits WHERE habits.id = completions.habit_id AND habits.user_id = auth.uid()
  )
);
```

This requires a new migration. Applicable when: implementing S-02 (completion logging API route) or any future API that inserts completions.

---

## L-002: src/types/database.ts is generated — do not hand-edit

**Rule:** `src/types/database.ts` is produced by `npx supabase gen types typescript --local > src/types/database.ts`. Any manual edit will be silently overwritten the next time the schema changes and the command is re-run. There is no in-file comment that survives the `>` redirect.

**Why:** The file has no regeneration guard. A developer unblocking themselves without a running local instance may hand-edit it. The next schema migration will then silently discard those edits.

**How to apply:** Never edit `src/types/database.ts` directly. When the schema changes (new migration), re-run the gen command with the local instance running. If type adjustments are needed (e.g. branded types, stricter ranges), create a separate `src/types/app.ts` that imports from `database.ts` and re-exports narrowed types — never modify the generated file itself.

---

## L-003: frequency and completed_on require runtime validation at API boundaries

**Rule:** The generated TypeScript types for `habits.frequency` (`number`) and `completions.completed_on` (`string`) are looser than the database constraints. `frequency` is typed as `number` even though the DB enforces `CHECK (frequency >= 1 AND frequency <= 7)`. `completed_on` is typed as `string` even though the DB expects an ISO 8601 date (`YYYY-MM-DD`).

**Why:** `supabase gen types` cannot represent numeric range checks or date format constraints in TypeScript. The type alone provides no compile-time enforcement.

**How to apply:**
- S-01 (habit creation API): validate `frequency` with a runtime check (e.g. Zod `.int().min(1).max(7)`) before inserting into `habits`.
- S-02 (completion logging API): validate `completed_on` is a valid ISO date string (e.g. Zod `.string().regex(/^\d{4}-\d{2}-\d{2}$/)` or `.date()`) before inserting into `completions`. Invalid dates silently pass TypeScript but fail at the Postgres level.

---

## L-004: Happy-path integration tests for ownership-gated endpoints must assert the eq spy

**Rule:** Any happy-path test (expected 2xx) for an endpoint that performs an ownership check must assert `expect(client.eq).toHaveBeenCalledWith("user_id", <userId>)` to prove the ownership filter ran — not just that the response was correct. A test that only checks status code and body would silently pass even if the ownership check were deleted from the handler.

**Why:** During testing-completion-dates review, the backdated-completion and week-boundary tests correctly asserted status 201 and the stored date, but skipped the `client.eq` spy. The duplicate test (409) in the same describe block included it. The gap was caught in impl-review; without the spy, two tests would pass even after removing the habit ownership lookup.

**How to apply:** When writing an integration test for an API route that includes a habit ownership check (`.eq("user_id", userId)` before the main operation), always add the eq spy assertion alongside the response assertions. Applies to all tests in `src/pages/api/habits/[id]/**/*.integration.test.ts` where the handler calls `.eq("user_id", ...)` as part of ownership verification.
