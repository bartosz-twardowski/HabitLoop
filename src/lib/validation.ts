const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateFrequency(
  value: unknown,
): { valid: true; frequency: number } | { valid: false; error: string } {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 7) {
    return { valid: false, error: "frequency must be an integer between 1 and 7" };
  }
  return { valid: true, frequency: value };
}

export function validateCompletionDate(
  value: unknown,
): { valid: true; date: string } | { valid: false; error: string } {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value) || isNaN(Date.parse(value))) {
    return { valid: false, error: "completed_on must be a valid ISO date (YYYY-MM-DD)" };
  }
  return { valid: true, date: value };
}
