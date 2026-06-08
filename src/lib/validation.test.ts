import { describe, it, expect } from "vitest";
import { validateFrequency, validateCompletionDate } from "@/lib/validation";

// ---------------------------------------------------------------------------
// validateFrequency
// ---------------------------------------------------------------------------
describe("validateFrequency", () => {
  it.each([1, 4, 7])("accepts valid frequency %d", (freq) => {
    const result = validateFrequency(freq);
    expect(result).toEqual({ valid: true, frequency: freq });
  });

  it.each([0, 8, -1])("rejects out-of-range integer %d", (freq) => {
    expect(validateFrequency(freq).valid).toBe(false);
  });

  it("rejects non-integer 3.5", () => {
    expect(validateFrequency(3.5).valid).toBe(false);
  });

  it("rejects NaN", () => {
    expect(validateFrequency(NaN).valid).toBe(false);
  });

  it("rejects Infinity", () => {
    expect(validateFrequency(Infinity).valid).toBe(false);
  });

  it("rejects string 'abc'", () => {
    expect(validateFrequency("abc").valid).toBe(false);
  });

  it("rejects null", () => {
    expect(validateFrequency(null).valid).toBe(false);
  });

  it("rejects undefined", () => {
    expect(validateFrequency(undefined).valid).toBe(false);
  });

  it("rejects object {}", () => {
    expect(validateFrequency({}).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateCompletionDate
// ---------------------------------------------------------------------------
describe("validateCompletionDate", () => {
  it.each(["2026-06-08", "2026-01-01", "2025-12-31"])("accepts valid ISO date %s", (date) => {
    const result = validateCompletionDate(date);
    expect(result).toEqual({ valid: true, date });
  });

  it.each(["not-a-date", "2026/06/08", "06-08-2026", "2026-6-8"])("rejects invalid format %s", (date) => {
    expect(validateCompletionDate(date).valid).toBe(false);
  });

  // Note: "2026-02-30" passes Date.parse() in V8 (rolls to Mar 2).
  // The DB layer catches truly impossible dates. This is a known limitation.

  it("rejects month 13", () => {
    expect(validateCompletionDate("2026-13-01").valid).toBe(false);
  });

  it("rejects number 123", () => {
    expect(validateCompletionDate(123).valid).toBe(false);
  });

  it("rejects null", () => {
    expect(validateCompletionDate(null).valid).toBe(false);
  });

  it("rejects undefined", () => {
    expect(validateCompletionDate(undefined).valid).toBe(false);
  });

  it("rejects object {}", () => {
    expect(validateCompletionDate({}).valid).toBe(false);
  });
});
