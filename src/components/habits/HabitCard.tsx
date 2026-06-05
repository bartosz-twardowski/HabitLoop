import { useState } from "react";
import type { RecommendationResult } from "@/lib/recommendation";

interface Props {
  id: string;
  name: string;
  frequency: number;
  createdAt: string;
  recommendation: RecommendationResult;
}

export default function HabitCard({ id, name, frequency: initialFrequency, recommendation: initialRec }: Props) {
  const [currentFrequency, setCurrentFrequency] = useState(initialFrequency);
  const [rec, setRec] = useState<RecommendationResult>(initialRec);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleAccept() {
    if (rec.kind !== "lower" && rec.kind !== "raise") return;
    const newFrequency = rec.newFrequency;
    // Optimistic update
    setCurrentFrequency(newFrequency);
    setRec({ kind: "maintain", explanation: "Goal updated." });
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/habits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency: newFrequency }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setCurrentFrequency(initialFrequency);
      setRec(initialRec);
      setError("Failed to update goal. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleDismiss() {
    if (rec.kind !== "lower" && rec.kind !== "raise") return;
    const prevRec = rec;
    // Optimistic update
    setRec({ ...rec, suppressed: true });
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/habits/${id}/dismiss-recommendation`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setRec(prevRec);
      setError("Failed to dismiss. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const showActions = (rec.kind === "lower" || rec.kind === "raise") && !rec.suppressed;

  return (
    <div className="rounded-xl border border-white/10 bg-white/10 px-5 py-4 text-white transition-colors hover:bg-white/20">
      <div className="flex items-center justify-between">
        <a href={`/habits/${id}`} className="font-medium hover:underline">
          {name}
        </a>
        <span className="flex items-center gap-3 text-sm text-blue-100/60">
          <span className="rounded-full border border-purple-400/40 bg-purple-900/30 px-2.5 py-0.5 text-xs text-purple-200">
            {currentFrequency}×/week
          </span>
        </span>
      </div>

      <div className="mt-3">
        {rec.kind === "insufficient_data" && (
          <p className="text-xs text-blue-100/50">
            First recommendation in {rec.daysUntilFirst} day{rec.daysUntilFirst !== 1 ? "s" : ""}
          </p>
        )}

        {(rec.kind === "lower" || rec.kind === "raise" || rec.kind === "maintain") &&
          !("suppressed" in rec && rec.suppressed) && (
            <div className="space-y-2">
              <p className="text-xs text-blue-100/70">{rec.explanation}</p>
              {showActions && (
                <div className="flex gap-2">
                  <button
                    onClick={handleAccept}
                    disabled={pending}
                    className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={pending}
                    className="rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
