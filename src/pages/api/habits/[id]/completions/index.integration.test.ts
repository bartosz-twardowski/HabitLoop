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

describe("POST /api/habits/[id]/completions — unauthenticated", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 with Unauthorized error when user is not logged in", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: null,
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2026-06-09" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(401);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("POST /api/habits/[id]/completions — date edge cases", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 409 when the same date is logged twice for the same habit", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "completions.single": {
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        },
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

    expect(response.status).toBe(409);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "This day is already logged" });
    expect(client.eq).toHaveBeenCalledWith("user_id", "owner-uuid");
  });

  it("accepts a backdated completion and stores it with the exact sent date", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "completions.single": { data: { id: "comp-1", completed_on: "2020-01-01" }, error: null },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2020-01-01" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(201);
    const body: unknown = await response.json();
    expect((body as Record<string, unknown>).completed_on).toBe("2020-01-01");
  });

  it("stores a week-boundary Sunday date as-is without rounding to Monday", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "completions.single": { data: { id: "comp-1", completed_on: "2026-06-07" }, error: null },
      },
    });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2026-06-07" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(201);
    const body: unknown = await response.json();
    expect((body as Record<string, unknown>).completed_on).toBe("2026-06-07");
    expect(client.from).toHaveBeenCalled();
  });

  it("returns 400 when completed_on uses slashes instead of dashes", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2026/06/09" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "completed_on must be a valid ISO date (YYYY-MM-DD)" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns 400 when completed_on has an invalid month (month 13)", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: { completed_on: "2026-13-01" },
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "completed_on must be a valid ISO date (YYYY-MM-DD)" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns 400 when completed_on field is missing from the request body", async () => {
    const client = createMockSupabaseClient({ results: {} });
    setupSupabaseMock(client);

    const { POST } = await import("@/pages/api/habits/[id]/completions/index");

    const ctx = createMockContext({
      user: { id: "owner-uuid" },
      params: { id: "habit-1" },
      method: "POST",
      body: {},
    });

    const response = await POST(ctx as never);

    expect(response.status).toBe(400);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "completed_on must be a valid ISO date (YYYY-MM-DD)" });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns 500 when the database returns a non-duplicate error on insert", async () => {
    const client = createMockSupabaseClient({
      results: {
        "habits.maybeSingle": { data: { id: "habit-1" }, error: null },
        "completions.single": { data: null, error: { message: "DB error" } },
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

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(body).toEqual({ error: "DB error" });
  });
});
