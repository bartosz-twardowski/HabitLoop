import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "./api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

describe("api-helpers", () => {
  describe("createMockSupabaseClient", () => {
    it("chains .from().select().eq().eq().maybeSingle() and returns configured data", async () => {
      const client = createMockSupabaseClient({
        results: {
          "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        },
      });

      const result = await client.from("habits").select("id").eq("id", "habit-1").eq("user_id", "u1").maybeSingle();

      expect(result).toEqual({ data: { id: "habit-1" }, error: null });
    });
  });

  describe("createMockContext", () => {
    it("produces object with correct locals.user and params", () => {
      const ctx = createMockContext({
        user: { id: "owner-uuid" },
        params: { id: "habit-1" },
        method: "PATCH",
        body: { frequency: 3 },
      });

      expect(ctx.locals.user).toEqual({ id: "owner-uuid" });
      expect(ctx.params).toEqual({ id: "habit-1" });
      expect(ctx.request.method).toBe("PATCH");
    });
  });

  describe("PATCH handler smoke test", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
    });

    it("returns 403 when ownership check returns null", async () => {
      const client = createMockSupabaseClient({
        results: {
          "habits.maybeSingle": { data: null, error: null },
        },
      });
      setupSupabaseMock(client);

      const { PATCH } = await import("@/pages/api/habits/[id]/index");

      const ctx = createMockContext({
        user: { id: "attacker-uuid" },
        params: { id: "habit-1" },
        method: "PATCH",
        body: { frequency: 3 },
      });

      const response = await PATCH(ctx as never);

      expect(response.status).toBe(403);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: "Habit not found" });
    });
  });
});
