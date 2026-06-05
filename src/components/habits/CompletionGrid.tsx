import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface Props {
  habitId: string;
  habitCreatedAt: string; // ISO timestamp — first week boundary
  frequency: number; // displayed in header
  initialCompletions: string[]; // array of "YYYY-MM-DD"
}

/** Returns a "YYYY-MM-DD" string for any Date in local time. */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the Monday of the week containing the given date (Mon = 0 offset). */
function startOfWeek(d: Date): Date {
  const clone = new Date(d);
  const dow = clone.getDay(); // 0 = Sun, 1 = Mon, …
  const diff = dow === 0 ? -6 : 1 - dow; // shift so Monday is day 0
  clone.setDate(clone.getDate() + diff);
  clone.setHours(0, 0, 0, 0);
  return clone;
}

/** Generates all weeks (Mon–Sun) from the week of `from` to the week of `to`. */
function buildWeeks(from: Date, to: Date): Date[][] {
  const weeks: Date[][] = [];
  const cursor = startOfWeek(from);
  const lastWeekStart = startOfWeek(to);

  while (cursor <= lastWeekStart) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CompletionGrid({ habitId, habitCreatedAt, frequency, initialCompletions }: Props) {
  const [loggedDates, setLoggedDates] = useState<Set<string>>(() => new Set(initialCompletions));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const [cy, cm, cd] = habitCreatedAt.split("-").map(Number);
  const createdDate = new Date(cy, cm - 1, cd);
  const today = new Date();
  const todayStr = toLocalISODate(today);
  const createdStr = toLocalISODate(createdDate);

  const weeks = buildWeeks(createdDate, today);
  const isTodayLogged = loggedDates.has(todayStr);

  async function toggle(dateStr: string) {
    if (pendingDate) return; // prevent concurrent toggles
    setErrorMsg(null);

    const wasLogged = loggedDates.has(dateStr);

    // Optimistic update
    setLoggedDates((prev) => {
      const next = new Set(prev);
      if (wasLogged) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
    setPendingDate(dateStr);

    try {
      const res = wasLogged
        ? await fetch(`/api/habits/${habitId}/completions/${dateStr}`, { method: "DELETE" })
        : await fetch(`/api/habits/${habitId}/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed_on: dateStr }),
          });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
    } catch (err) {
      // Revert optimistic update
      setLoggedDates((prev) => {
        const next = new Set(prev);
        if (wasLogged) next.add(dateStr);
        else next.delete(dateStr);
        return next;
      });
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPendingDate(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-blue-100/60">
          Target: <span className="font-medium text-white">{frequency}×/week</span>
        </p>
        <button
          type="button"
          onClick={() => toggle(todayStr)}
          disabled={pendingDate !== null}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            isTodayLogged
              ? "border border-purple-400/40 bg-purple-900/30 text-purple-200 hover:bg-purple-900/50"
              : "border border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
          }`}
        >
          {isTodayLogged ? (
            <>
              <CheckCircle2 className="size-4" />
              Logged today ✓
            </>
          ) : (
            <>
              <Circle className="size-4" />
              Log today
            </>
          )}
        </button>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="rounded-lg border border-red-400/30 bg-red-900/20 px-3 py-2 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Day column headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-blue-100/40">
            {label}
          </div>
        ))}
      </div>

      {/* Week rows — oldest at top, newest at bottom */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const dateStr = toLocalISODate(day);
              const isBeforeCreation = dateStr < createdStr;
              const isLogged = loggedDates.has(dateStr);
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const isDisabled = isBeforeCreation || isFuture || pendingDate !== null;
              const isPending = pendingDate === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => !isDisabled && toggle(dateStr)}
                  disabled={isDisabled}
                  aria-label={`${dateStr}${isLogged ? " (logged)" : ""}`}
                  aria-pressed={isLogged}
                  className={[
                    "flex aspect-square w-full items-center justify-center rounded-md text-xs transition-colors",
                    isBeforeCreation || isFuture
                      ? "cursor-default opacity-20"
                      : isLogged
                        ? "bg-purple-600 text-white hover:bg-purple-500"
                        : "border border-white/10 bg-white/5 text-white/40 hover:bg-white/10",
                    isToday ? "ring-2 ring-purple-400 ring-offset-1 ring-offset-transparent" : "",
                    isPending ? "animate-pulse" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
