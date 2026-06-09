import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient, createMockContext, setupSupabaseMock } from "@/test-utils/api-helpers";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

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
});
