import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "@/test-utils/api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

describe("DELETE /api/habits/[id]/completions/[date] — ownership enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("owner receives 200 with ok: true", async () => {
    const client = createMockSupabaseClient({
      results: {
        "completions.then": { count: 1, error: null },
      },
    });
    setupSupabaseMock(client);

    const { DELETE } = await import("@/pages/api/habits/[id]/completions/[date]");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1", date: "2026-06-09" },
      method: "DELETE",
    });

    const response = await DELETE(ctx as never);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it("attacker receives 403 with no completion data", async () => {
    const client = createMockSupabaseClient({
      results: {
        "completions.then": { count: 0, error: null },
      },
    });
    setupSupabaseMock(client);

    const { DELETE } = await import("@/pages/api/habits/[id]/completions/[date]");

    const ctx = createMockContext({
      user: { id: "attacker-uuid" },
      params: { id: "habit-1", date: "2026-06-09" },
      method: "DELETE",
    });

    const response = await DELETE(ctx as never);

    expect(response.status).toBe(403);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Completion not found" });
    expect(Object.keys(body as Record<string, unknown>)).toEqual(["error"]);
    expect(client.eq).toHaveBeenCalledWith("user_id", "attacker-uuid");
  });

  it("returns 500 when database returns an error", async () => {
    const client = createMockSupabaseClient({
      results: {
        "completions.then": { count: null, error: { message: "DB error" } },
      },
    });
    setupSupabaseMock(client);

    const { DELETE } = await import("@/pages/api/habits/[id]/completions/[date]");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1", date: "2026-06-09" },
      method: "DELETE",
    });

    const response = await DELETE(ctx as never);

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "DB error" });
  });
});

describe("DELETE /api/habits/[id]/completions/[date] — unauthenticated", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 with Unauthorized error when user is not logged in", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { DELETE } = await import("@/pages/api/habits/[id]/completions/[date]");

    const ctx = createMockContext({
      user: null,
      params: { id: "habit-1", date: "2026-06-09" },
      method: "DELETE",
    });

    const response = await DELETE(ctx as never);

    expect(response.status).toBe(401);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(client.from).not.toHaveBeenCalled();
  });
});
