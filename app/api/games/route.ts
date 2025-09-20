// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeTeamAbbr } from "@/lib/odds";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

// Filter to "today" (UTC) — adjust if you later want US/Eastern
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
    const { start, end } = todayBoundsUTC();

    // Your games table columns: game_id, game_date, home_team, away_team, commence_time, created_at, sport_key
    const { data, error } = await supabase
      .from("games")
      .select("game_id, home_team, away_team, commence_time")
      .gte("commence_time", start)
      .lt("commence_time", end)
      .order("commence_time", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows =
      (data ?? []).map((g: any) => {
        const homeAbbr = normalizeTeamAbbr(g.home_team).toLowerCase();
        const awayAbbr = normalizeTeamAbbr(g.away_team).toLowerCase();
        return {
          // downstream expects both id and game_id as strings
          id: String(g.game_id),
          game_id: String(g.game_id),
          home_team_abbr: homeAbbr,
          away_team_abbr: awayAbbr,
          commence_time: g.commence_time, // ISO
        };
      });

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
