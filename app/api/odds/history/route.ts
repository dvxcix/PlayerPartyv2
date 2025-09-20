import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const playerIds = searchParams.get("player_ids");
  const marketKey = searchParams.get("market_key");

  if (!playerIds || !marketKey) {
    return NextResponse.json({ ok: false, error: "Missing params" }, { status: 400 });
  }

  const supabase = createClient();

  // Get odds history for today only, for selected players
  const { data, error } = await supabase
    .from("odds_history")
    .select("*")
    .in("player_id", playerIds.split(","))
    .eq("market_key", marketKey)
    .gte("captured_at", new Date().toISOString().split("T")[0])
    .lte("captured_at", new Date().toISOString().split("T")[0] + " 23:59:59")
    .order("captured_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
