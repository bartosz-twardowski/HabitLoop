import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "@/test-utils/api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

function makeFormRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields).toString();
  return new Request("http://localhost/api/habits", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

describe("POST /api/habits", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe("unauthenticated", () => {
    it("returns 401 with Unauthorized error when user is not logged in", async () => {
      const client = createMockSupabaseClient({ results: {} });
      setupSupabaseMock(client);

      const { POST } = await import("@/pages/api/habits/index");

      const ctx = createMockContext({
        user: null,
        params: {},
        method: "POST",
      });

      const response = await POST(ctx as never);

      expect(response.status).toBe(401);
      const body: unknown = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
      expect(client.from).not.toHaveBeenCalled();
    });
  });

  describe("authenticated", () => {
    it("owner receives 302 redirect to /dashboard on successful creation", async () => {
      const client = createMockSupabaseClient({
        results: {
          "habits.then": { data: null, error: null },
        },
      });
      setupSupabaseMock(client);

      const { POST } = await import("@/pages/api/habits/index");

      const base = createMockContext({ user: { id: "owner-uuid" }, params: {} });
      const ctx = { ...base, request: makeFormRequest({ name: "Morning Run", frequency: "3" }) };

      const response = await POST(ctx as never);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");
    });

    it("returns 302 redirect with error when habit name is missing", async () => {
      const client = createMockSupabaseClient({ results: {} });
      setupSupabaseMock(client);

      const { POST } = await import("@/pages/api/habits/index");

      const base = createMockContext({ user: { id: "owner-uuid" }, params: {} });
      const ctx = { ...base, request: makeFormRequest({ name: "", frequency: "3" }) };

      const response = await POST(ctx as never);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("/dashboard/new?error=");
      expect(client.from).not.toHaveBeenCalled();
    });
  });
});
