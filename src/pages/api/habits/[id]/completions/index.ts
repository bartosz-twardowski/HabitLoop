import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const completed_on = (body as Record<string, unknown> | null)?.completed_on;

  // Runtime validation per L-003
  if (typeof completed_on !== "string" || !ISO_DATE_RE.test(completed_on) || isNaN(Date.parse(completed_on))) {
    return Response.json({ error: "completed_on must be a valid ISO date (YYYY-MM-DD)" }, { status: 400 });
  }

  // Ownership check per L-001 — verify before insert
  const { data: habit } = await supabase.from("habits").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (!habit) {
    return Response.json({ error: "Habit not found" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("completions")
    .insert({ habit_id: id, user_id: user.id, completed_on })
    .select("id, completed_on")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "This day is already logged" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
};
