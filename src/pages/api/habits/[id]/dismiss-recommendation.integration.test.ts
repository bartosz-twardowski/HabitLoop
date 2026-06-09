import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "@/test-utils/api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/habits/[id]/dismiss-recommendation — ownership enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("owner receives 200 with ok: true and update is stamped with a dismissed_at ISO timestamp", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "habits.then": { data: null, error: null },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/dismiss-recommendation");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({ ok: true });
    expect(client.eq).toHaveBeenCalledWith("user_id", "owner-uuid");
    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        recommendation_dismissed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it("attacker receives 403 with no habit data", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: null, error: null },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/dismiss-recommendation");

    const ctx = createMockContext({
      user: { id: "attacker-uuid" },
      params: { id: "habit-1" },
      method: "POST",
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(403);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Habit not found" });
    expect(Object.keys(body as Record<string, unknown>)).toEqual(["error"]);
    expect(client.eq).toHaveBeenCalledWith("user_id", "attacker-uuid");
  });
});

describe("POST /api/habits/[id]/dismiss-recommendation — DB error", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 500 when database returns an error on update", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "habits.then": { data: null, error: { message: "DB error" } },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/dismiss-recommendation");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "DB error" });
  });
});

describe("POST /api/habits/[id]/dismiss-recommendation — unauthenticated", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 with Unauthorized error when user is not logged in", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/dismiss-recommendation");

    const ctx = createMockContext({
      user: null,
      params: { id: "habit-1" },
      method: "POST",
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(401);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(client.from).not.toHaveBeenCalled();
  });
});
