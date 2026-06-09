import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "@/test-utils/api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

describe("PATCH /api/habits/[id] — ownership enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("owner receives 200 with habit data", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "habits.single": { data: { id: "habit-1", frequency: 3 }, error: null },
      },
    });
    setupSupabaseMock(client);

    const { PATCH } = await import("@/pages/api/habits/[id]/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "PATCH",
      body: { frequency: 3 },
    });

    const response = await PATCH(ctx as never);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({ id: "habit-1", frequency: 3 });
  });

  it("attacker receives 403 with no habit data", async () => {
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
    expect(Object.keys(body as Record<string, unknown>)).toEqual(["error"]);
  });
});
