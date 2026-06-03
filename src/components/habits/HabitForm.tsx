import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

const FREQUENCIES = [1, 2, 3, 4, 5, 6, 7] as const;

export default function HabitForm({ serverError }: Props) {
  const [name, setName] = useState("");
  const [freq, setFreq] = useState(3);
  const [nameError, setNameError] = useState<string | undefined>();

  function validate() {
    if (!name.trim()) {
      setNameError("Habit name is required");
      return false;
    }
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) e.preventDefault();
  }

  return (
    <form method="POST" action="/api/habits" className="space-y-5" onSubmit={handleSubmit} noValidate>
      <FormField
        id="name"
        label="Habit name"
        value={name}
        onChange={(v) => {
          setName(v);
          if (nameError) setNameError(undefined);
        }}
        placeholder="e.g. Morning run"
        error={nameError}
        icon={<BookOpen className="size-4" />}
      />

      <div>
        <p className="mb-2 text-sm text-blue-100/80">Times per week</p>
        <div className="flex gap-2">
          {FREQUENCIES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setFreq(n);
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                freq === n
                  ? "border-purple-400 bg-purple-600 text-white"
                  : "border-white/20 bg-white/10 text-white/70 hover:bg-white/20"
              }`}
              aria-pressed={freq === n}
            >
              {n}
            </button>
          ))}
        </div>
        <input type="hidden" name="frequency" value={freq} />
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating..." icon={<BookOpen className="size-4" />}>
        Create habit
      </SubmitButton>
    </form>
  );
}
