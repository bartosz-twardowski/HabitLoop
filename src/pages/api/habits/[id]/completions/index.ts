import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { validateCompletionDate } from "@/lib/validation";

export const POST: APIRoute = async (context) => {
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

  const dateResult = validateCompletionDate((body as Record<string, unknown> | null)?.completed_on);
  if (!dateResult.valid) {
    return Response.json({ error: dateResult.error }, { status: 400 });
  }

  // Ownership check per L-001 — verify before insert
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
    .from("completions")
    .insert({ habit_id: id, user_id: user.id, completed_on: dateResult.date })
    .select("id, completed_on")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "This day is already logged" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
};
