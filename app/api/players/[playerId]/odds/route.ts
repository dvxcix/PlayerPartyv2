// app/api/players/[playerId]/odds/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { playerId: string } }) {
  try {
    const { playerId } = params;
    const { searchParams } = new URL(req.url);
    const game_id = searchParams.get("game_id");
    const market_key = searchParams.get("market_key") || "batter_home_runs";

    const q = supabaseAdmin
      .from("odds_history")
      .select("captured_at, american_odds, bookmaker")
      .eq("player_id", playerId)
      .eq("market_key", market_key)
      .order("captured_at");

    const { data, error } = game_id ? await q.eq("game_id", game_id) : await q;
    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
