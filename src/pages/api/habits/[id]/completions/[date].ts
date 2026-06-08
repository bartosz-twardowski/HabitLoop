import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { validateCompletionDate } from "@/lib/validation";

export const DELETE: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return Response.json({ error: "Service unavailable" }, { status: 503 });
  }

  const user = context.locals.user;
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, date } = context.params;
  if (!id || !date) {
    return Response.json({ error: "Missing habit id or date" }, { status: 400 });
  }

  // Runtime validation per L-003
  const dateResult = validateCompletionDate(date);
  if (!dateResult.valid) {
    return Response.json({ error: "date must be a valid ISO date (YYYY-MM-DD)" }, { status: 400 });
  }

  // Delete only the row that belongs to this user — user_id condition is the ownership guard.
  // Merges "not found" and "not owner" into 403 to avoid leaking existence of other users' rows.
  const { count, error } = await supabase
    .from("completions")
    .delete({ count: "exact" })
    .eq("habit_id", id)
    .eq("user_id", user.id)
    .eq("completed_on", dateResult.date);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (count === null || count === 0) {
    return Response.json({ error: "Completion not found" }, { status: 403 });
  }

  return Response.json({ ok: true }, { status: 200 });
};
