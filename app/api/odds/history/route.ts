// app/api/odds/history/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const url = new URL(req.url);
    const playerIds = url.searchParams.getAll("player_ids");
    const gameIds = url.searchParams.getAll("game_ids");

    if (!playerIds.length || !gameIds.length) {
      return NextResponse.json({ ok: false, error: "Missing player_ids or game_ids" }, { status: 400 });
    }

    // today's date only
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("odds_history")
      .select("player_id, game_id, market_key, american_odds, bookmaker, captured_at")
      .in("player_id", playerIds)
      .in("game_id", gameIds)
      .gte("captured_at", `${today}T00:00:00Z`)
      .lte("captured_at", `${today}T23:59:59Z`)
      .order("captured_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
