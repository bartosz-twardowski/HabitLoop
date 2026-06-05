import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

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

  // Ownership check per L-001 — verify before update
  const { data: habit } = await supabase.from("habits").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (!habit) {
    return Response.json({ error: "Habit not found" }, { status: 403 });
  }

  const { error } = await supabase
    .from("habits")
    .update({ recommendation_dismissed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
};
