import { describe, it, expect } from "vitest";
import { computeRecommendation } from "@/lib/recommendation";

describe("computeRecommendation (smoke)", () => {
  it("returns a result with a kind property", () => {
    const result = computeRecommendation(
      { frequency: 3, created_at: "2020-01-01T00:00:00Z", recommendation_dismissed_at: null },
      [],
      new Date("2026-06-04T12:00:00Z"),
    );
    expect(result).toHaveProperty("kind");
  });
});
