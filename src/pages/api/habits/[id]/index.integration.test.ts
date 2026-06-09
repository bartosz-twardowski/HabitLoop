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

  it("owner receives 200 with frequency updated and recommendation_dismissed_at cleared to null", async () => {
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
    expect(client.eq).toHaveBeenCalledWith("user_id", "owner-uuid");
    expect(client.update).toHaveBeenCalledWith({ frequency: 3, recommendation_dismissed_at: null });
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
    expect(client.eq).toHaveBeenCalledWith("user_id", "attacker-uuid");
  });
});

describe("PATCH /api/habits/[id] — unauthenticated", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 with Unauthorized error when user is not logged in", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { PATCH } = await import("@/pages/api/habits/[id]/index");

    const ctx = createMockContext({
      user: null,
      params: { id: "habit-1" },
      method: "PATCH",
      body: { frequency: 3 },
    });

    const response = await PATCH(ctx as never);

    expect(response.status).toBe(401);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/habits/[id] — frequency validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 400 when frequency is missing from request body", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { PATCH } = await import("@/pages/api/habits/[id]/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "PATCH",
      body: {},
    });

    const response = await PATCH(ctx as never);

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "frequency must be an integer between 1 and 7" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns 400 when frequency is out of range (8)", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { PATCH } = await import("@/pages/api/habits/[id]/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "PATCH",
      body: { frequency: 8 },
    });

    const response = await PATCH(ctx as never);

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "frequency must be an integer between 1 and 7" });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/habits/[id] — DB error", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 500 when database returns an error on update", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "habits.single": { data: null, error: { message: "DB error" } },
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

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "DB error" });
  });
});
