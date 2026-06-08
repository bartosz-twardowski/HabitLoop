import { describe, it, expect } from "vitest";
import {
  getMondayUTC,
  toISODateStr,
  getCompletedWeeks,
  countInWeek,
  isSuppressed,
  getThreeWeeksAgoDateStr,
  computeRecommendation,
} from "@/lib/recommendation";

// ---------------------------------------------------------------------------
// Helper: getMondayUTC
// ---------------------------------------------------------------------------
describe("getMondayUTC", () => {
  it("returns the same Monday when given a Monday", () => {
    const mon = getMondayUTC(new Date("2026-06-08T12:00:00Z"));
    expect(mon.toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it.each([
    ["Tuesday", "2026-06-09T15:00:00Z"],
    ["Wednesday", "2026-06-10T08:00:00Z"],
    ["Thursday", "2026-06-11T20:00:00Z"],
    ["Friday", "2026-06-12T03:00:00Z"],
    ["Saturday", "2026-06-13T23:00:00Z"],
    ["Sunday", "2026-06-14T06:00:00Z"],
  ])("returns Monday 2026-06-08 for %s", (_day, iso) => {
    expect(getMondayUTC(new Date(iso)).toISOString()).toBe("2026-06-08T00:00:00.000Z");
  });

  it("crosses month boundary (July 1 Wed → June 29 Mon)", () => {
    const mon = getMondayUTC(new Date("2026-07-01T00:00:00Z"));
    expect(mon.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("crosses year boundary (Jan 1 2026 Thu → Dec 29 2025 Mon)", () => {
    const mon = getMondayUTC(new Date("2026-01-01T00:00:00Z"));
    expect(mon.toISOString()).toBe("2025-12-29T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// Helper: toISODateStr
// ---------------------------------------------------------------------------
describe("toISODateStr", () => {
  it("formats a mid-year date", () => {
    expect(toISODateStr(new Date(Date.UTC(2026, 5, 8)))).toBe("2026-06-08");
  });

  it("zero-pads single-digit month and day", () => {
    expect(toISODateStr(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });

  it("handles Dec 31", () => {
    expect(toISODateStr(new Date(Date.UTC(2026, 11, 31)))).toBe("2026-12-31");
  });

  it("handles Jan 1", () => {
    expect(toISODateStr(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01-01");
  });
});

// ---------------------------------------------------------------------------
// Helper: getCompletedWeeks
// ---------------------------------------------------------------------------
describe("getCompletedWeeks", () => {
  // today = Wed 2026-06-10 → thisMonday = 2026-06-08
  const today = new Date("2026-06-10T12:00:00Z");

  it("returns 3 Mon-Sun weeks, most-recent first", () => {
    const weeks = getCompletedWeeks(today, 3);
    expect(weeks).toEqual([
      { start: "2026-06-01", end: "2026-06-07" },
      { start: "2026-05-25", end: "2026-05-31" },
      { start: "2026-05-18", end: "2026-05-24" },
    ]);
  });

  it("returns 1 week when count=1", () => {
    const weeks = getCompletedWeeks(today, 1);
    expect(weeks).toEqual([{ start: "2026-06-01", end: "2026-06-07" }]);
  });

  it("all week ends are strictly before this Monday", () => {
    const weeks = getCompletedWeeks(today, 3);
    for (const w of weeks) {
      expect(w.end < "2026-06-08").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Helper: countInWeek
// ---------------------------------------------------------------------------
describe("countInWeek", () => {
  it("counts completions inside [start, end] inclusive", () => {
    const dates = ["2026-06-02", "2026-06-05", "2026-06-10"];
    expect(countInWeek(dates, "2026-06-01", "2026-06-07")).toBe(2);
  });

  it("returns 0 for empty array", () => {
    expect(countInWeek([], "2026-06-01", "2026-06-07")).toBe(0);
  });

  it("returns 0 when all dates are out of range", () => {
    const dates = ["2026-05-30", "2026-06-08"];
    expect(countInWeek(dates, "2026-06-01", "2026-06-07")).toBe(0);
  });

  it("includes boundary dates (start and end)", () => {
    const dates = ["2026-06-01", "2026-06-07"];
    expect(countInWeek(dates, "2026-06-01", "2026-06-07")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Helper: isSuppressed
// ---------------------------------------------------------------------------
describe("isSuppressed", () => {
  it("returns false when dismissedAt is null", () => {
    expect(isSuppressed(null, [{ created_at: "2026-06-05T10:00:00Z" }])).toBe(false);
  });

  it("returns true when dismissed and no completions logged after", () => {
    expect(isSuppressed("2026-06-08T12:00:00Z", [{ created_at: "2026-06-02T10:00:00Z" }])).toBe(true);
  });

  it("returns false when a completion exists after the dismiss timestamp", () => {
    expect(
      isSuppressed("2026-06-08T12:00:00Z", [
        { created_at: "2026-06-02T10:00:00Z" },
        { created_at: "2026-06-09T10:00:00Z" },
      ]),
    ).toBe(false);
  });

  it("returns true when dismissed with empty completions", () => {
    expect(isSuppressed("2026-06-08T12:00:00Z", [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helper: getThreeWeeksAgoDateStr
// ---------------------------------------------------------------------------
describe("getThreeWeeksAgoDateStr", () => {
  it("returns the Monday of the 3rd completed week before today", () => {
    // today = Wed 2026-06-10 → oldest of 3 weeks starts 2026-05-18
    const result = getThreeWeeksAgoDateStr(new Date("2026-06-10T12:00:00Z"));
    expect(result).toBe("2026-05-18");
  });

  it("matches the start of the oldest week from getCompletedWeeks", () => {
    const today = new Date("2026-06-10T12:00:00Z");
    const weeks = getCompletedWeeks(today, 3);
    expect(getThreeWeeksAgoDateStr(today)).toBe(weeks[weeks.length - 1].start);
  });
});

// ---------------------------------------------------------------------------
// computeRecommendation — scenario tests
// All expected values are hand-calculated from PRD business rules.
// today = Wed 2026-06-10 → most recent completed week: Mon Jun 1 – Sun Jun 7
// ---------------------------------------------------------------------------
describe("computeRecommendation", () => {
  const TODAY = new Date("2026-06-10T12:00:00Z");

  const makeHabit = (
    frequency: number,
    created_at = "2020-01-01T00:00:00Z",
    recommendation_dismissed_at: string | null = null,
  ) => ({ frequency, created_at, recommendation_dismissed_at });

  const makeCompletion = (completed_on: string, created_at?: string) => ({
    completed_on,
    created_at: created_at ?? `${completed_on}T10:00:00Z`,
  });

  // Scenario 1: count(1) < freq(3), freq > 1 → lower to 2
  it("recommends lower when completions are below target", () => {
    const result = computeRecommendation(makeHabit(3), [makeCompletion("2026-06-02")], TODAY);
    expect(result.kind).toBe("lower");
    if (result.kind === "lower") {
      expect(result.newFrequency).toBe(2);
      expect(result.suppressed).toBe(false);
    }
  });

  // Scenario 2: count(5) > freq(3), freq < 7 → raise to 4
  it("recommends raise when completions exceed target", () => {
    const result = computeRecommendation(
      makeHabit(3),
      [
        makeCompletion("2026-06-01"),
        makeCompletion("2026-06-02"),
        makeCompletion("2026-06-03"),
        makeCompletion("2026-06-04"),
        makeCompletion("2026-06-05"),
      ],
      TODAY,
    );
    expect(result.kind).toBe("raise");
    if (result.kind === "raise") {
      expect(result.newFrequency).toBe(4);
      expect(result.suppressed).toBe(false);
    }
  });

  // Scenario 3: count(3) === freq(3) → maintain
  it("recommends maintain when completions exactly match target", () => {
    const result = computeRecommendation(
      makeHabit(3),
      [makeCompletion("2026-06-01"), makeCompletion("2026-06-03"), makeCompletion("2026-06-05")],
      TODAY,
    );
    expect(result.kind).toBe("maintain");
    if (result.kind === "maintain") {
      expect(result.explanation).toContain("keep it up");
    }
  });

  // Scenario 4: count(0) < freq(1), freq === 1 → maintain at floor
  it("maintains at floor when frequency is already 1 and user under-performs", () => {
    const result = computeRecommendation(makeHabit(1), [], TODAY);
    expect(result.kind).toBe("maintain");
    if (result.kind === "maintain") {
      expect(result.explanation).toContain("minimum");
    }
  });

  // Scenario 5: count(8) > freq(7), freq === 7 → maintain at ceiling
  // Artificial: 8 entries (one duplicate date) to push count above 7
  it("maintains at ceiling when frequency is already 7 and user over-performs", () => {
    const result = computeRecommendation(
      makeHabit(7),
      [
        makeCompletion("2026-06-01"),
        makeCompletion("2026-06-02"),
        makeCompletion("2026-06-03"),
        makeCompletion("2026-06-04"),
        makeCompletion("2026-06-05"),
        makeCompletion("2026-06-06"),
        makeCompletion("2026-06-07"),
        makeCompletion("2026-06-01", "2026-06-01T20:00:00Z"), // duplicate date, different created_at
      ],
      TODAY,
    );
    expect(result.kind).toBe("maintain");
    if (result.kind === "maintain") {
      expect(result.explanation).toContain("maximum");
    }
  });

  // Scenario 6: habit created 2026-06-01 (Mon) → only 1 available week → insufficient_data
  // creationMonday = Jun 1, firstCompleteWeekStart = Jun 8, dayAfterSecondComplete = Jun 22
  // todayUTC = Jun 10, diff = 12 days
  it("returns insufficient_data when fewer than 2 full weeks available", () => {
    const result = computeRecommendation(makeHabit(3, "2026-06-01T00:00:00Z"), [], TODAY);
    expect(result.kind).toBe("insufficient_data");
    if (result.kind === "insufficient_data") {
      expect(result.daysUntilFirst).toBe(12);
    }
  });

  // Scenario 7: habit created mid-week 2026-06-04 (Thu) → same Monday, still only 1 available week
  // Same daysUntilFirst because creationMonday is still Jun 1
  it("returns insufficient_data for mid-week creation (partial first week)", () => {
    const result = computeRecommendation(makeHabit(3, "2026-06-04T00:00:00Z"), [], TODAY);
    expect(result.kind).toBe("insufficient_data");
    if (result.kind === "insufficient_data") {
      expect(result.daysUntilFirst).toBe(12);
    }
  });

  // Scenario 8: lower recommendation is suppressed (dismissed, no new completions after)
  it("returns lower with suppressed=true when dismissed and no new completions", () => {
    const result = computeRecommendation(
      makeHabit(3, "2020-01-01T00:00:00Z", "2026-06-08T12:00:00Z"),
      [makeCompletion("2026-06-02", "2026-06-02T10:00:00Z")],
      TODAY,
    );
    expect(result.kind).toBe("lower");
    if (result.kind === "lower") {
      expect(result.newFrequency).toBe(2);
      expect(result.suppressed).toBe(true);
    }
  });

  // Scenario 9: suppression cleared — new completion logged after dismiss timestamp
  it("returns lower with suppressed=false when a completion exists after dismiss", () => {
    const result = computeRecommendation(
      makeHabit(3, "2020-01-01T00:00:00Z", "2026-06-08T12:00:00Z"),
      [
        makeCompletion("2026-06-02", "2026-06-02T10:00:00Z"),
        makeCompletion("2026-06-09", "2026-06-09T14:00:00Z"), // after dismiss, outside most-recent week
      ],
      TODAY,
    );
    expect(result.kind).toBe("lower");
    if (result.kind === "lower") {
      expect(result.newFrequency).toBe(2);
      expect(result.suppressed).toBe(false);
    }
  });

  // Scenario 10: zero completions with freq > 1 → lower
  it("recommends lower when there are zero completions and frequency > 1", () => {
    const result = computeRecommendation(makeHabit(5), [], TODAY);
    expect(result.kind).toBe("lower");
    if (result.kind === "lower") {
      expect(result.newFrequency).toBe(4);
      expect(result.suppressed).toBe(false);
    }
  });
});
