import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { validateFrequency } from "@/lib/validation";

export const PATCH: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  if (!id) {
    return Response.json({ error: "Missing habit id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const freqResult = validateFrequency((body as Record<string, unknown> | null)?.frequency);
  if (!freqResult.valid) {
    return Response.json({ error: freqResult.error }, { status: 400 });
  }

  // Ownership check per L-001 — verify before update
  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (habitError) {
    return Response.json({ error: habitError.message }, { status: 500 });
  }

  if (!habit) {
    return Response.json({ error: "Habit not found" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("habits")
    .update({ frequency: freqResult.frequency, recommendation_dismissed_at: null })
    .eq("id", id)
    .select("id, frequency")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
};
