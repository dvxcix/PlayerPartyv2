// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

// UTC day window for "today"
function todayBoundsUTC() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return NextResponse.json({ ok: false, error: "Supabase env not set" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Prefer a view if you created one, otherwise read from `games`
    // Try v_games_today first (non-fatal if it doesn't exist)
    const { start, end } = todayBoundsUTC();

    // Attempt 1: read from games table for today (safe + always present)
    const { data, error } = await supabase
      .from("games")
      .select("id, game_id, home_team_abbr, away_team_abbr, commence_time")
      .gte("commence_time", start)
      .lt("commence_time", end)
      .order("commence_time", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Normalize rows (ensure id/game_id are strings, abbrs lowercased like your DB)
    const rows = (data ?? []).map((g: any) => ({
      id: String(g.id ?? g.game_id ?? ""),
      game_id: String(g.game_id ?? g.id ?? ""),
      home_team_abbr: (g.home_team_abbr ?? "").toLowerCase(),
      away_team_abbr: (g.away_team_abbr ?? "").toLowerCase(),
      commence_time: g.commence_time, // ISO
    }));

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
