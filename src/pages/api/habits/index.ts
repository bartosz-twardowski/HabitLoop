import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { validateFrequency } from "@/lib/validation";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard/new?error=${encodeURIComponent("Service unavailable")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const name = ((form.get("name") as string | null) ?? "").trim();
  const freqRaw = form.get("frequency") as string | null;
  const frequency = freqRaw !== null ? Number(freqRaw) : NaN;

  // Runtime validation per L-003
  if (!name) {
    return context.redirect(`/dashboard/new?error=${encodeURIComponent("Habit name is required")}`);
  }

  const freqResult = validateFrequency(frequency);
  if (!freqResult.valid) {
    return context.redirect(`/dashboard/new?error=${encodeURIComponent("Frequency must be between 1 and 7")}`);
  }

  const { error } = await supabase.from("habits").insert({ name, frequency: freqResult.frequency, user_id: user.id });

  if (error) {
    return context.redirect(`/dashboard/new?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
