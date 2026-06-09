import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "@/test-utils/api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/habits/[id]/completions — ownership enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("owner receives 201 with completion data", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "completions.single": { data: { id: "comp-1", completed_on: "2026-06-09" }, error: null },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2026-06-09" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(201);
    const body: unknown = await response.json();
    expect(body).toEqual({ id: "comp-1", completed_on: "2026-06-09" });
  });

  it("attacker receives 403 with no completion data", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: null, error: null },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "attacker-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2026-06-09" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(403);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Habit not found" });
    expect(Object.keys(body as Record<string, unknown>)).toEqual(["error"]);
    expect(client.eq).toHaveBeenCalledWith("user_id", "attacker-uuid");
  });
});
