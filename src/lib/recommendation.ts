export type RecommendationResult =
  | { kind: "lower"; newFrequency: number; explanation: string; suppressed: boolean }
  | { kind: "raise"; newFrequency: number; explanation: string; suppressed: boolean }
  | { kind: "maintain"; explanation: string }
  | { kind: "insufficient_data"; daysUntilFirst: number };

// Returns Monday 00:00 UTC of the week containing d
export function getMondayUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysFromMonday));
  return monday;
}

// "YYYY-MM-DD" from UTC fields — avoids timezone off-by-one
export function toISODateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Last `count` complete Mon–Sun weeks before today, most-recent first
// A "complete" week ends strictly before today's Monday
export function getCompletedWeeks(today: Date, count: number): { start: string; end: string }[] {
  const thisMonday = getMondayUTC(today);
  const weeks: { start: string; end: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const weekStart = new Date(thisMonday.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    weeks.push({ start: toISODateStr(weekStart), end: toISODateStr(weekEnd) });
  }
  return weeks;
}

// Count completions whose completed_on falls in [weekStart, weekEnd] (inclusive, string comparison)
export function countInWeek(completedOns: string[], weekStart: string, weekEnd: string): number {
  return completedOns.filter((d) => d >= weekStart && d <= weekEnd).length;
}

export function computeRecommendation(
  habit: {
    frequency: number;
    created_at: string;
    recommendation_dismissed_at: string | null;
  },
  completions: { completed_on: string; created_at: string }[],
  today: Date = new Date(),
): RecommendationResult {
  const weeks = getCompletedWeeks(today, 3);
  const createdDateStr = habit.created_at.slice(0, 10);

  // Available weeks: weeks whose end date is strictly after the habit creation date
  const availableWeeks = weeks.filter((w) => w.end > createdDateStr);

  if (availableWeeks.length < 2) {
    // Compute days until first recommendation is possible
    const createdDate = new Date(createdDateStr + "T00:00:00Z");
    // First complete week that starts after the creation week
    const creationMonday = getMondayUTC(createdDate);
    const firstCompleteWeekStart = new Date(creationMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
    // End of 2nd complete week + 1 day = when 2 full weeks are available
    const dayAfterSecondComplete = new Date(firstCompleteWeekStart.getTime() + 14 * 24 * 60 * 60 * 1000);
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const diffMs = dayAfterSecondComplete.getTime() - todayUTC.getTime();
    const daysUntilFirst = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    return { kind: "insufficient_data", daysUntilFirst };
  }

  // Use most recent available week (index 0)
  const { start, end } = availableWeeks[0];
  const completedOns = completions.map((c) => c.completed_on);
  const count = countInWeek(completedOns, start, end);
  const { frequency } = habit;

  if (count < frequency) {
    if (frequency === 1) {
      return { kind: "maintain", explanation: "Your goal is already at the minimum (1×/week). Keep going!" };
    }
    const newFrequency = frequency - 1;
    const suppressed = isSuppressed(habit.recommendation_dismissed_at, completions);
    return {
      kind: "lower",
      newFrequency,
      explanation: `You completed ${count} of ${frequency} target days last week. Lowering your goal to ${newFrequency}×/week.`,
      suppressed,
    };
  }

  if (count > frequency) {
    if (frequency === 7) {
      return { kind: "maintain", explanation: "You've reached the maximum goal (7×/week). Excellent!" };
    }
    const newFrequency = frequency + 1;
    const suppressed = isSuppressed(habit.recommendation_dismissed_at, completions);
    return {
      kind: "raise",
      newFrequency,
      explanation: `You completed ${count} of ${frequency} target days last week — great! Raising your goal to ${newFrequency}×/week.`,
      suppressed,
    };
  }

  // count === frequency
  return { kind: "maintain", explanation: "You're hitting your goal — keep it up!" };
}

export function isSuppressed(dismissedAt: string | null, completions: { created_at: string }[]): boolean {
  if (dismissedAt === null) return false;
  return !completions.some((c) => c.created_at > dismissedAt);
}

// Returns ISO date string for Monday of the 3rd completed week before today —
// used as the `gte` filter in the dashboard completions query.
export function getThreeWeeksAgoDateStr(today: Date = new Date()): string {
  const weeks = getCompletedWeeks(today, 3);
  return weeks[weeks.length - 1].start;
}
